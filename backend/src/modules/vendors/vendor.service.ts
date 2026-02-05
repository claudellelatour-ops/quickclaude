import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { CreateVendorInput, UpdateVendorInput, VendorQuery } from './vendor.schema';
import { generateCode, decimalToNumber } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';

export class VendorService {
  /**
   * Get vendors with pagination
   */
  async getVendors(companyId: string, query: VendorQuery) {
    const where: Prisma.VendorWhereInput = { companyId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.is1099Eligible !== undefined) {
      where.is1099Eligible = query.is1099Eligible;
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          defaultExpenseAccount: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      vendors,
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Get single vendor with balance
   */
  async getVendor(companyId: string, vendorId: string) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
      include: {
        defaultExpenseAccount: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const balance = await this.calculateBalance(vendorId);

    return { ...vendor, balance };
  }

  /**
   * Create vendor
   */
  async createVendor(companyId: string, input: CreateVendorInput) {
    const code = input.code || await this.generateVendorCode(companyId, input.name);

    const existing = await prisma.vendor.findUnique({
      where: { companyId_code: { companyId, code } },
    });

    if (existing) {
      throw new ConflictError('Vendor code already exists');
    }

    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        code,
        name: input.name,
        displayName: input.displayName || input.name,
        email: input.email || null,
        phone: input.phone,
        website: input.website || null,
        address: input.address || null,
        paymentTerms: input.paymentTerms,
        defaultExpenseAccountId: input.defaultExpenseAccountId,
        taxId: input.taxId,
        is1099Eligible: input.is1099Eligible,
        notes: input.notes,
        customFields: input.customFields || {},
      },
    });

    return { ...vendor, balance: 0 };
  }

  /**
   * Update vendor
   */
  async updateVendor(companyId: string, vendorId: string, input: UpdateVendorInput) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (input.code && input.code !== vendor.code) {
      const existing = await prisma.vendor.findUnique({
        where: { companyId_code: { companyId, code: input.code } },
      });

      if (existing) {
        throw new ConflictError('Vendor code already exists');
      }
    }

    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...input,
        email: input.email || null,
        website: input.website || null,
      },
    });

    const balance = await this.calculateBalance(vendorId);

    return { ...updated, balance };
  }

  /**
   * Deactivate vendor
   */
  async deactivateVendor(companyId: string, vendorId: string) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive: false },
    });
  }

  /**
   * Get vendor transactions
   */
  async getVendorTransactions(companyId: string, vendorId: string) {
    const [bills, payments] = await Promise.all([
      prisma.bill.findMany({
        where: { vendorId, companyId },
        select: {
          id: true,
          billNumber: true,
          vendorRef: true,
          date: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          amountDue: true,
          status: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.billPayment.findMany({
        where: { vendorId, companyId },
        select: {
          id: true,
          paymentNumber: true,
          date: true,
          amount: true,
          method: true,
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    return {
      bills: bills.map((bill) => ({
        ...bill,
        total: decimalToNumber(bill.total),
        amountPaid: decimalToNumber(bill.amountPaid),
        amountDue: decimalToNumber(bill.amountDue),
      })),
      payments: payments.map((pmt) => ({
        ...pmt,
        amount: decimalToNumber(pmt.amount),
      })),
    };
  }

  /**
   * Calculate vendor outstanding balance
   */
  async calculateBalance(vendorId: string): Promise<number> {
    const result = await prisma.bill.aggregate({
      where: {
        vendorId,
        status: { notIn: ['DRAFT', 'VOID'] },
      },
      _sum: {
        amountDue: true,
      },
    });

    return decimalToNumber(result._sum.amountDue);
  }

  /**
   * Generate unique vendor code
   */
  private async generateVendorCode(companyId: string, name: string): Promise<string> {
    const baseCode = generateCode(name, 6);

    let code = baseCode;
    let counter = 1;

    while (true) {
      const existing = await prisma.vendor.findUnique({
        where: { companyId_code: { companyId, code } },
      });

      if (!existing) break;

      code = `${baseCode}${counter}`;
      counter++;
    }

    return code;
  }
}

export const vendorService = new VendorService();
