import { prisma } from '../../config/database';
import { JournalSource, AccountSubType, InvoiceStatus, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { CreateCustomerPaymentInput, CustomerPaymentQuery, PaymentAllocationInput } from './customerPayment.schema';
import { decimalToNumber, round } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';
import { journalService } from '../journal/journal.service';
import { accountService } from '../accounts/account.service';
import { invoiceService } from '../invoices/invoice.service';

export class CustomerPaymentService {
  /**
   * Get customer payments with pagination
   */
  async getPayments(companyId: string, query: CustomerPaymentQuery) {
    const where: Prisma.CustomerPaymentWhereInput = { companyId };

    if (query.customerId) where.customerId = query.customerId;

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [payments, total] = await Promise.all([
      prisma.customerPayment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          allocations: {
            include: {
              invoice: { select: { id: true, invoiceNumber: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.customerPayment.count({ where }),
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
    const payment = await prisma.customerPayment.findFirst({
      where: { id: paymentId, companyId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        bankAccount: { select: { id: true, bankName: true } },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
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
   * Create customer payment
   */
  async createPayment(companyId: string, userId: string, input: CreateCustomerPaymentInput) {
    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Validate allocations
    if (input.allocations && input.allocations.length > 0) {
      await this.validateAllocations(companyId, input.customerId, input.amount, input.allocations);
    }

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(companyId);

    // Get accounts
    const arAccount = await accountService.getSystemAccount(
      companyId,
      AccountSubType.ACCOUNTS_RECEIVABLE
    );

    // Determine deposit account
    let depositAccountId: string;
    if (input.bankAccountId) {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: input.bankAccountId },
      });
      if (!bankAccount) {
        throw new NotFoundError('Bank account not found');
      }
      depositAccountId = bankAccount.accountId;
    } else {
      // Use undeposited funds
      const undepositedAccount = await accountService.getSystemAccount(
        companyId,
        AccountSubType.OTHER_ASSET
      );
      depositAccountId = undepositedAccount.id;
    }

    // Create payment
    const payment = await prisma.customerPayment.create({
      data: {
        companyId,
        customerId: input.customerId,
        paymentNumber,
        date: new Date(input.date),
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        memo: input.memo,
        bankAccountId: input.bankAccountId,
        allocations: input.allocations
          ? {
              create: input.allocations.map((alloc) => ({
                invoiceId: alloc.invoiceId,
                amount: alloc.amount,
              })),
            }
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
        },
      },
    });

    // Create journal entry
    await journalService.createFromTransaction(companyId, userId, {
      date: new Date(input.date),
      memo: `Payment from ${customer.name}`,
      reference: paymentNumber,
      source: JournalSource.CUSTOMER_PAYMENT,
      sourceId: payment.id,
      lines: [
        {
          accountId: depositAccountId,
          debit: input.amount,
          credit: 0,
          memo: `Payment received`,
        },
        {
          accountId: arAccount.id,
          debit: 0,
          credit: input.amount,
          customerId: input.customerId,
          memo: `Payment received`,
        },
      ],
    });

    // Apply payment to invoices
    if (input.allocations) {
      for (const alloc of input.allocations) {
        await invoiceService.applyPayment(alloc.invoiceId, alloc.amount);
      }
    }

    return this.formatPayment(payment);
  }

  /**
   * Delete payment (reverses GL and invoice allocations)
   */
  async deletePayment(companyId: string, paymentId: string) {
    const payment = await prisma.customerPayment.findFirst({
      where: { id: paymentId, companyId },
      include: { allocations: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Reverse invoice allocations
    for (const alloc of payment.allocations) {
      await invoiceService.applyPayment(alloc.invoiceId, -decimalToNumber(alloc.amount));
    }

    // Void journal entry
    await prisma.journalEntry.updateMany({
      where: {
        companyId,
        source: JournalSource.CUSTOMER_PAYMENT,
        sourceId: payment.id,
      },
      data: { isPosted: false },
    });

    // Delete payment
    await prisma.customerPayment.delete({
      where: { id: paymentId },
    });
  }

  /**
   * Validate payment allocations
   */
  private async validateAllocations(
    companyId: string,
    customerId: string,
    totalAmount: number,
    allocations: PaymentAllocationInput[]
  ) {
    let allocatedAmount = 0;

    for (const alloc of allocations) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: alloc.invoiceId,
          companyId,
          customerId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        },
      });

      if (!invoice) {
        throw new BadRequestError('Invalid invoice for allocation');
      }

      const amountDue = decimalToNumber(invoice.amountDue);
      if (alloc.amount > amountDue) {
        throw new BadRequestError(
          `Allocation amount (${alloc.amount}) exceeds invoice balance (${amountDue})`
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
    const lastPayment = await prisma.customerPayment.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const settings = company?.settings as any || {};
    const prefix = settings.paymentPrefix || 'PMT-';

    if (!lastPayment) {
      return `${prefix}1001`;
    }

    const match = lastPayment.paymentNumber.match(/(\d+)$/);
    const lastNumber = match ? parseInt(match[1]) : 1000;

    return `${prefix}${lastNumber + 1}`;
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
        invoice: alloc.invoice
          ? {
              ...alloc.invoice,
              total: alloc.invoice.total ? decimalToNumber(alloc.invoice.total) : undefined,
              amountDue: alloc.invoice.amountDue
                ? decimalToNumber(alloc.invoice.amountDue)
                : undefined,
            }
          : undefined,
      })),
    };
  }
}

export const customerPaymentService = new CustomerPaymentService();
