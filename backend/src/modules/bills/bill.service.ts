import { prisma } from '../../config/database';
import { BillStatus, JournalSource, AccountSubType, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import { CreateBillInput, UpdateBillInput, BillQuery, BillLineInput } from './bill.schema';
import { decimalToNumber, calculateDueDate, round } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';
import { journalService } from '../journal/journal.service';
import { accountService } from '../accounts/account.service';

export class BillService {
  /**
   * Get bills with pagination
   */
  async getBills(companyId: string, query: BillQuery) {
    const where: Prisma.BillWhereInput = { companyId };

    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    if (query.search) {
      where.OR = [
        { billNumber: { contains: query.search, mode: 'insensitive' } },
        { vendorRef: { contains: query.search, mode: 'insensitive' } },
        { vendor: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { billNumber: 'desc' }],
        skip,
        take,
      }),
      prisma.bill.count({ where }),
    ]);

    return {
      bills: bills.map(this.formatBill),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Get single bill with lines
   */
  async getBill(companyId: string, billId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId },
      include: {
        vendor: { select: { id: true, name: true, address: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            tax: { select: { id: true, name: true, rate: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        paymentAllocations: {
          include: {
            payment: {
              select: { id: true, paymentNumber: true, date: true, amount: true },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundError('Bill not found');
    }

    return this.formatBill(bill);
  }

  /**
   * Create bill
   */
  async createBill(companyId: string, userId: string, input: CreateBillInput) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, companyId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const billNumber = input.billNumber || await this.generateBillNumber(companyId);

    const existing = await prisma.bill.findUnique({
      where: { companyId_billNumber: { companyId, billNumber } },
    });

    if (existing) {
      throw new ConflictError('Bill number already exists');
    }

    const { lines, subtotal, taxTotal, total } = await this.calculateLineTotals(
      companyId,
      input.lines
    );

    const billDate = new Date(input.date);
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : calculateDueDate(billDate, input.terms);

    const bill = await prisma.bill.create({
      data: {
        companyId,
        vendorId: input.vendorId,
        billNumber,
        vendorRef: input.vendorRef,
        date: billDate,
        dueDate,
        terms: input.terms,
        subtotal,
        taxTotal,
        total,
        amountPaid: 0,
        amountDue: total,
        status: BillStatus.RECEIVED,
        memo: input.memo,
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            sortOrder: index,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    // Create journal entry immediately for bills
    await this.postBillToGL(companyId, userId, bill);

    return this.formatBill(bill);
  }

  /**
   * Update bill (only draft/received bills)
   */
  async updateBill(
    companyId: string,
    userId: string,
    billId: string,
    input: UpdateBillInput
  ) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId },
    });

    if (!bill) {
      throw new NotFoundError('Bill not found');
    }

    if (bill.status !== BillStatus.DRAFT && bill.status !== BillStatus.RECEIVED) {
      throw new BadRequestError('Only draft or received bills can be edited');
    }

    if (decimalToNumber(bill.amountPaid) > 0) {
      throw new BadRequestError('Cannot edit bill with payments');
    }

    let updateData: any = { ...input };

    if (input.lines) {
      const { lines, subtotal, taxTotal, total } = await this.calculateLineTotals(
        companyId,
        input.lines
      );

      updateData = {
        ...updateData,
        subtotal,
        taxTotal,
        total,
        amountDue: total,
        lines: {
          deleteMany: {},
          create: lines.map((line, index) => ({
            ...line,
            sortOrder: index,
          })),
        },
      };
      delete updateData.lines;
    }

    if (input.date) {
      updateData.date = new Date(input.date);
      if (!input.dueDate) {
        updateData.dueDate = calculateDueDate(
          updateData.date,
          input.terms || bill.terms
        );
      }
    }

    if (input.dueDate) {
      updateData.dueDate = new Date(input.dueDate);
    }

    // Void old journal entry
    await prisma.journalEntry.updateMany({
      where: {
        companyId,
        source: JournalSource.BILL,
        sourceId: bill.id,
      },
      data: { isPosted: false },
    });

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    // Create new journal entry
    await this.postBillToGL(companyId, userId, updated);

    return this.formatBill(updated);
  }

  /**
   * Void bill
   */
  async voidBill(companyId: string, billId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId },
    });

    if (!bill) {
      throw new NotFoundError('Bill not found');
    }

    if (bill.status === BillStatus.VOID) {
      throw new BadRequestError('Bill is already voided');
    }

    if (decimalToNumber(bill.amountPaid) > 0) {
      throw new BadRequestError('Cannot void bill with payments');
    }

    await prisma.journalEntry.updateMany({
      where: {
        companyId,
        source: JournalSource.BILL,
        sourceId: bill.id,
      },
      data: { isPosted: false },
    });

    await prisma.bill.update({
      where: { id: billId },
      data: { status: BillStatus.VOID },
    });
  }

  /**
   * Apply payment to bill
   */
  async applyPayment(billId: string, amount: number) {
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      throw new NotFoundError('Bill not found');
    }

    const currentPaid = decimalToNumber(bill.amountPaid);
    const total = decimalToNumber(bill.total);
    const newPaid = round(currentPaid + amount);
    const newDue = round(total - newPaid);

    let status = bill.status;
    if (newDue <= 0) {
      status = BillStatus.PAID;
    } else if (newPaid > 0) {
      status = BillStatus.PARTIAL;
    }

    await prisma.bill.update({
      where: { id: billId },
      data: {
        amountPaid: newPaid,
        amountDue: Math.max(0, newDue),
        status,
      },
    });
  }

  /**
   * Post bill to GL
   */
  private async postBillToGL(companyId: string, userId: string, bill: any) {
    const apAccount = await accountService.getSystemAccount(
      companyId,
      AccountSubType.ACCOUNTS_PAYABLE
    );

    const journalLines: any[] = [];

    // Debit expense accounts
    for (const line of bill.lines) {
      const amount = decimalToNumber(line.amount);
      if (amount > 0) {
        journalLines.push({
          accountId: line.accountId,
          debit: amount,
          credit: 0,
          vendorId: bill.vendorId,
          memo: line.description,
        });
      }

      const taxAmount = decimalToNumber(line.taxAmount);
      if (taxAmount > 0) {
        journalLines.push({
          accountId: line.accountId,
          debit: taxAmount,
          credit: 0,
          memo: 'Tax',
        });
      }
    }

    // Credit AP
    journalLines.push({
      accountId: apAccount.id,
      debit: 0,
      credit: decimalToNumber(bill.total),
      vendorId: bill.vendorId,
      memo: `Bill ${bill.billNumber}`,
    });

    await journalService.createFromTransaction(companyId, userId, {
      date: bill.date,
      memo: `Bill ${bill.billNumber} - ${bill.vendor.name}`,
      reference: bill.billNumber,
      source: JournalSource.BILL,
      sourceId: bill.id,
      lines: journalLines,
    });
  }

  /**
   * Generate bill number
   */
  private async generateBillNumber(companyId: string): Promise<string> {
    const lastBill = await prisma.bill.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const settings = company?.settings as any || {};
    const prefix = settings.billPrefix || 'BILL-';

    if (!lastBill) {
      return `${prefix}1001`;
    }

    const match = lastBill.billNumber.match(/(\d+)$/);
    const lastNumber = match ? parseInt(match[1]) : 1000;

    return `${prefix}${lastNumber + 1}`;
  }

  /**
   * Calculate line totals
   */
  private async calculateLineTotals(companyId: string, lines: BillLineInput[]) {
    let subtotal = 0;
    let taxTotal = 0;

    const calculatedLines = await Promise.all(
      lines.map(async (line) => {
        const lineAmount = round(line.quantity * line.unitPrice);
        let taxAmount = 0;
        let taxRate = 0;

        if (line.taxRateId) {
          const tax = await prisma.taxRate.findUnique({
            where: { id: line.taxRateId },
          });
          if (tax) {
            taxRate = decimalToNumber(tax.rate);
            taxAmount = round(lineAmount * taxRate);
          }
        }

        subtotal += lineAmount;
        taxTotal += taxAmount;

        return {
          accountId: line.accountId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: lineAmount,
          taxRateId: line.taxRateId,
          taxRate,
          taxAmount,
          customerId: line.customerId,
          isBillable: line.isBillable,
        };
      })
    );

    const total = round(subtotal + taxTotal);

    return { lines: calculatedLines, subtotal, taxTotal, total };
  }

  /**
   * Format bill for response
   */
  private formatBill(bill: any) {
    return {
      ...bill,
      subtotal: decimalToNumber(bill.subtotal),
      taxTotal: decimalToNumber(bill.taxTotal),
      total: decimalToNumber(bill.total),
      amountPaid: decimalToNumber(bill.amountPaid),
      amountDue: decimalToNumber(bill.amountDue),
      lines: bill.lines?.map((line: any) => ({
        ...line,
        quantity: decimalToNumber(line.quantity),
        unitPrice: decimalToNumber(line.unitPrice),
        amount: decimalToNumber(line.amount),
        taxRate: decimalToNumber(line.taxRate),
        taxAmount: decimalToNumber(line.taxAmount),
      })),
    };
  }
}

export const billService = new BillService();
