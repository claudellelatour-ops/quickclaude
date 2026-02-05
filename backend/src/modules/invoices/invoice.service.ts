import { prisma } from '../../config/database';
import { InvoiceStatus, JournalSource, AccountSubType, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import { CreateInvoiceInput, UpdateInvoiceInput, InvoiceQuery, InvoiceLineInput } from './invoice.schema';
import { decimalToNumber, calculateDueDate, round } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';
import { journalService } from '../journal/journal.service';
import { accountService } from '../accounts/account.service';

export class InvoiceService {
  /**
   * Get invoices with pagination
   */
  async getInvoices(companyId: string, query: InvoiceQuery) {
    const where: Prisma.InvoiceWhereInput = { companyId };

    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ date: 'desc' }, { invoiceNumber: 'desc' }],
        skip,
        take,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map(this.formatInvoice),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Get single invoice with lines
   */
  async getInvoice(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: {
          select: { id: true, name: true, email: true, billingAddress: true },
        },
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
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

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return this.formatInvoice(invoice);
  }

  /**
   * Create invoice
   */
  async createInvoice(companyId: string, userId: string, input: CreateInvoiceInput) {
    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Generate invoice number
    const invoiceNumber = input.invoiceNumber || await this.generateInvoiceNumber(companyId);

    // Check for duplicate
    const existing = await prisma.invoice.findUnique({
      where: { companyId_invoiceNumber: { companyId, invoiceNumber } },
    });

    if (existing) {
      throw new ConflictError('Invoice number already exists');
    }

    // Calculate totals
    const { lines, subtotal, taxTotal, discountTotal, total } = await this.calculateLineTotals(
      companyId,
      input.lines
    );

    const invoiceDate = new Date(input.date);
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : calculateDueDate(invoiceDate, input.terms);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        customerId: input.customerId,
        invoiceNumber,
        date: invoiceDate,
        dueDate,
        terms: input.terms,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        amountPaid: 0,
        amountDue: total,
        status: InvoiceStatus.DRAFT,
        memo: input.memo,
        notes: input.notes,
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            sortOrder: index,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return this.formatInvoice(invoice);
  }

  /**
   * Update invoice (only draft invoices)
   */
  async updateInvoice(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: UpdateInvoiceInput
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestError('Only draft invoices can be edited');
    }

    // Calculate new totals if lines changed
    let updateData: any = { ...input };

    if (input.lines) {
      const { lines, subtotal, taxTotal, discountTotal, total } = await this.calculateLineTotals(
        companyId,
        input.lines
      );

      updateData = {
        ...updateData,
        subtotal,
        taxTotal,
        discountTotal,
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
          input.terms || invoice.terms
        );
      }
    }

    if (input.dueDate) {
      updateData.dueDate = new Date(input.dueDate);
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return this.formatInvoice(updated);
  }

  /**
   * Send invoice (changes status to SENT and creates GL entry)
   */
  async sendInvoice(companyId: string, userId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: true,
        lines: {
          include: { account: true, tax: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestError('Invoice has already been sent');
    }

    // Get system accounts
    const arAccount = await accountService.getSystemAccount(
      companyId,
      AccountSubType.ACCOUNTS_RECEIVABLE
    );
    const taxAccount = await accountService.getSystemAccount(
      companyId,
      AccountSubType.CURRENT_LIABILITY
    );

    // Build journal entry lines
    const journalLines: any[] = [];

    // Debit AR
    journalLines.push({
      accountId: arAccount.id,
      debit: decimalToNumber(invoice.total),
      credit: 0,
      customerId: invoice.customerId,
      memo: `Invoice ${invoice.invoiceNumber}`,
    });

    // Credit revenue accounts
    for (const line of invoice.lines) {
      const amount = decimalToNumber(line.amount) - decimalToNumber(line.discountAmount);
      if (amount > 0) {
        journalLines.push({
          accountId: line.accountId,
          debit: 0,
          credit: amount,
          memo: line.description,
        });
      }
    }

    // Credit tax payable
    const taxTotal = decimalToNumber(invoice.taxTotal);
    if (taxTotal > 0) {
      journalLines.push({
        accountId: taxAccount.id,
        debit: 0,
        credit: taxTotal,
        memo: 'Sales tax',
      });
    }

    // Create journal entry
    await journalService.createFromTransaction(companyId, userId, {
      date: invoice.date,
      memo: `Invoice ${invoice.invoiceNumber} - ${invoice.customer.name}`,
      reference: invoice.invoiceNumber,
      source: JournalSource.INVOICE,
      sourceId: invoice.id,
      lines: journalLines,
    });

    // Update invoice status
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
      },
    });

    // Check if overdue
    if (updated.dueDate < new Date() && updated.amountDue > 0) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.OVERDUE },
      });
    }

    return this.formatInvoice(updated);
  }

  /**
   * Void invoice
   */
  async voidInvoice(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestError('Invoice is already voided');
    }

    if (decimalToNumber(invoice.amountPaid) > 0) {
      throw new BadRequestError('Cannot void invoice with payments. Remove payments first.');
    }

    // Void related journal entries
    await prisma.journalEntry.updateMany({
      where: {
        companyId,
        source: JournalSource.INVOICE,
        sourceId: invoice.id,
      },
      data: { isPosted: false },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID },
    });
  }

  /**
   * Apply payment to invoice (internal use)
   */
  async applyPayment(invoiceId: string, amount: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const currentPaid = decimalToNumber(invoice.amountPaid);
    const total = decimalToNumber(invoice.total);
    const newPaid = round(currentPaid + amount);
    const newDue = round(total - newPaid);

    let status = invoice.status;
    if (newDue <= 0) {
      status = InvoiceStatus.PAID;
    } else if (newPaid > 0) {
      status = InvoiceStatus.PARTIAL;
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newPaid,
        amountDue: Math.max(0, newDue),
        status,
      },
    });
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const lastInvoice = await prisma.invoice.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    // Get company settings for prefix
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const settings = company?.settings as any || {};
    const prefix = settings.invoicePrefix || 'INV-';
    const startNumber = settings.invoiceStartNumber || 1001;

    if (!lastInvoice) {
      return `${prefix}${startNumber}`;
    }

    // Extract number from last invoice
    const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
    const lastNumber = match ? parseInt(match[1]) : startNumber - 1;

    return `${prefix}${lastNumber + 1}`;
  }

  /**
   * Calculate line totals
   */
  private async calculateLineTotals(companyId: string, lines: InvoiceLineInput[]) {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    const calculatedLines = await Promise.all(
      lines.map(async (line) => {
        const lineAmount = round(line.quantity * line.unitPrice);
        const discountAmount = round(lineAmount * (line.discountPercent / 100));
        const afterDiscount = lineAmount - discountAmount;

        let taxAmount = 0;
        let taxRate = 0;

        if (line.taxRateId) {
          const tax = await prisma.taxRate.findUnique({
            where: { id: line.taxRateId },
          });
          if (tax) {
            taxRate = decimalToNumber(tax.rate);
            taxAmount = round(afterDiscount * taxRate);
          }
        }

        subtotal += lineAmount;
        discountTotal += discountAmount;
        taxTotal += taxAmount;

        return {
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: lineAmount,
          discountPercent: line.discountPercent,
          discountAmount,
          taxRateId: line.taxRateId,
          taxRate,
          taxAmount,
          accountId: line.accountId,
        };
      })
    );

    const total = round(subtotal - discountTotal + taxTotal);

    return {
      lines: calculatedLines,
      subtotal,
      taxTotal,
      discountTotal,
      total,
    };
  }

  /**
   * Format invoice for response
   */
  private formatInvoice(invoice: any) {
    return {
      ...invoice,
      subtotal: decimalToNumber(invoice.subtotal),
      taxTotal: decimalToNumber(invoice.taxTotal),
      discountTotal: decimalToNumber(invoice.discountTotal),
      total: decimalToNumber(invoice.total),
      amountPaid: decimalToNumber(invoice.amountPaid),
      amountDue: decimalToNumber(invoice.amountDue),
      lines: invoice.lines?.map((line: any) => ({
        ...line,
        quantity: decimalToNumber(line.quantity),
        unitPrice: decimalToNumber(line.unitPrice),
        amount: decimalToNumber(line.amount),
        discountPercent: decimalToNumber(line.discountPercent),
        discountAmount: decimalToNumber(line.discountAmount),
        taxRate: decimalToNumber(line.taxRate),
        taxAmount: decimalToNumber(line.taxAmount),
      })),
    };
  }
}

export const invoiceService = new InvoiceService();
