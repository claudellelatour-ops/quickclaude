import { prisma } from '../../config/database';
import { JournalSource, AccountSubType, BillStatus, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { CreateBillPaymentInput, BillPaymentQuery, BillPaymentAllocationInput } from './billPayment.schema';
import { decimalToNumber } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';
import { journalService } from '../journal/journal.service';
import { accountService } from '../accounts/account.service';
import { billService } from '../bills/bill.service';

export class BillPaymentService {
  /**
   * Get bill payments with pagination
   */
  async getPayments(companyId: string, query: BillPaymentQuery) {
    const where: Prisma.BillPaymentWhereInput = { companyId };

    if (query.vendorId) where.vendorId = query.vendorId;

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [payments, total] = await Promise.all([
      prisma.billPayment.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true } },
          allocations: {
            include: {
              bill: { select: { id: true, billNumber: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.billPayment.count({ where }),
    ]);

    return {
      payments: payments.map(this.formatPayment),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Get single payment
   */
  async getPayment(companyId: string, paymentId: string) {
    const payment = await prisma.billPayment.findFirst({
      where: { id: paymentId, companyId },
      include: {
        vendor: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, bankName: true } },
        allocations: {
          include: {
            bill: {
              select: {
                id: true,
                billNumber: true,
                vendorRef: true,
                date: true,
                total: true,
                amountDue: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return this.formatPayment(payment);
  }

  /**
   * Create bill payment
   */
  async createPayment(companyId: string, userId: string, input: CreateBillPaymentInput) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, companyId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (input.allocations && input.allocations.length > 0) {
      await this.validateAllocations(companyId, input.vendorId, input.amount, input.allocations);
    }

    const paymentNumber = await this.generatePaymentNumber(companyId);

    // Get AP account
    const apAccount = await accountService.getSystemAccount(
      companyId,
      AccountSubType.ACCOUNTS_PAYABLE
    );

    // Determine payment account
    let paymentAccountId: string;
    if (input.bankAccountId) {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: input.bankAccountId },
      });
      if (!bankAccount) {
        throw new NotFoundError('Bank account not found');
      }
      paymentAccountId = bankAccount.accountId;
    } else {
      // Use cash account
      const cashAccount = await accountService.getSystemAccount(
        companyId,
        AccountSubType.CASH
      );
      paymentAccountId = cashAccount.id;
    }

    // Create payment
    const payment = await prisma.billPayment.create({
      data: {
        companyId,
        vendorId: input.vendorId,
        paymentNumber,
        date: new Date(input.date),
        amount: input.amount,
        method: input.method,
        bankAccountId: input.bankAccountId,
        checkNumber: input.checkNumber,
        reference: input.reference,
        memo: input.memo,
        allocations: input.allocations
          ? {
              create: input.allocations.map((alloc) => ({
                billId: alloc.billId,
                amount: alloc.amount,
              })),
            }
          : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        allocations: {
          include: {
            bill: { select: { id: true, billNumber: true } },
          },
        },
      },
    });

    // Create journal entry
    await journalService.createFromTransaction(companyId, userId, {
      date: new Date(input.date),
      memo: `Payment to ${vendor.name}`,
      reference: paymentNumber,
      source: JournalSource.BILL_PAYMENT,
      sourceId: payment.id,
      lines: [
        {
          accountId: apAccount.id,
          debit: input.amount,
          credit: 0,
          vendorId: input.vendorId,
          memo: `Payment to vendor`,
        },
        {
          accountId: paymentAccountId,
          debit: 0,
          credit: input.amount,
          memo: `Payment to vendor`,
        },
      ],
    });

    // Apply payment to bills
    if (input.allocations) {
      for (const alloc of input.allocations) {
        await billService.applyPayment(alloc.billId, alloc.amount);
      }
    }

    return this.formatPayment(payment);
  }

  /**
   * Delete payment
   */
  async deletePayment(companyId: string, paymentId: string) {
    const payment = await prisma.billPayment.findFirst({
      where: { id: paymentId, companyId },
      include: { allocations: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Reverse bill allocations
    for (const alloc of payment.allocations) {
      await billService.applyPayment(alloc.billId, -decimalToNumber(alloc.amount));
    }

    // Void journal entry
    await prisma.journalEntry.updateMany({
      where: {
        companyId,
        source: JournalSource.BILL_PAYMENT,
        sourceId: payment.id,
      },
      data: { isPosted: false },
    });

    // Delete payment
    await prisma.billPayment.delete({
      where: { id: paymentId },
    });
  }

  /**
   * Validate payment allocations
   */
  private async validateAllocations(
    companyId: string,
    vendorId: string,
    totalAmount: number,
    allocations: BillPaymentAllocationInput[]
  ) {
    let allocatedAmount = 0;

    for (const alloc of allocations) {
      const bill = await prisma.bill.findFirst({
        where: {
          id: alloc.billId,
          companyId,
          vendorId,
          status: { in: [BillStatus.RECEIVED, BillStatus.PARTIAL, BillStatus.OVERDUE] },
        },
      });

      if (!bill) {
        throw new BadRequestError('Invalid bill for allocation');
      }

      const amountDue = decimalToNumber(bill.amountDue);
      if (alloc.amount > amountDue) {
        throw new BadRequestError(
          `Allocation amount (${alloc.amount}) exceeds bill balance (${amountDue})`
        );
      }

      allocatedAmount += alloc.amount;
    }

    if (allocatedAmount > totalAmount) {
      throw new BadRequestError(
        `Total allocations (${allocatedAmount}) exceed payment amount (${totalAmount})`
      );
    }
  }

  /**
   * Generate payment number
   */
  private async generatePaymentNumber(companyId: string): Promise<string> {
    const lastPayment = await prisma.billPayment.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastPayment) {
      return 'CHK-1001';
    }

    const match = lastPayment.paymentNumber.match(/(\d+)$/);
    const lastNumber = match ? parseInt(match[1]) : 1000;

    return `CHK-${lastNumber + 1}`;
  }

  /**
   * Format payment for response
   */
  private formatPayment(payment: any) {
    return {
      ...payment,
      amount: decimalToNumber(payment.amount),
      allocations: payment.allocations?.map((alloc: any) => ({
        ...alloc,
        amount: decimalToNumber(alloc.amount),
        bill: alloc.bill
          ? {
              ...alloc.bill,
              total: alloc.bill.total ? decimalToNumber(alloc.bill.total) : undefined,
              amountDue: alloc.bill.amountDue ? decimalToNumber(alloc.bill.amountDue) : undefined,
            }
          : undefined,
      })),
    };
  }
}

export const billPaymentService = new BillPaymentService();
