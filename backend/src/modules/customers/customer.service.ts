import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from './customer.schema';
import { generateCode, decimalToNumber } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';

export class CustomerService {
  /**
   * Get customers with pagination
   */
  async getCustomers(companyId: string, query: CustomerQuery) {
    const where: Prisma.CustomerWhereInput = { companyId };

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

    const { skip, take } = getPagination(query.page, query.limit);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers: customers.map((c) => ({
        ...c,
        creditLimit: c.creditLimit ? decimalToNumber(c.creditLimit) : null,
      })),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Get single customer with balance
   */
  async getCustomer(companyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Calculate outstanding balance
    const balance = await this.calculateBalance(customerId);

    return {
      ...customer,
      creditLimit: customer.creditLimit ? decimalToNumber(customer.creditLimit) : null,
      balance,
    };
  }

  /**
   * Create customer
   */
  async createCustomer(companyId: string, input: CreateCustomerInput) {
    // Generate code if not provided
    const code = input.code || await this.generateCustomerCode(companyId, input.name);

    // Check for duplicate code
    const existing = await prisma.customer.findUnique({
      where: { companyId_code: { companyId, code } },
    });

    if (existing) {
      throw new ConflictError('Customer code already exists');
    }

    const customer = await prisma.customer.create({
      data: {
        companyId,
        code,
        name: input.name,
        displayName: input.displayName || input.name,
        email: input.email || null,
        phone: input.phone,
        website: input.website || null,
        billingAddress: input.billingAddress || null,
        shippingAddress: input.shippingAddress || null,
        paymentTerms: input.paymentTerms,
        creditLimit: input.creditLimit,
        taxExempt: input.taxExempt,
        taxExemptNumber: input.taxExemptNumber,
        notes: input.notes,
        customFields: input.customFields || {},
      },
    });

    return {
      ...customer,
      creditLimit: customer.creditLimit ? decimalToNumber(customer.creditLimit) : null,
      balance: 0,
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(companyId: string, customerId: string, input: UpdateCustomerInput) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check code uniqueness if changing
    if (input.code && input.code !== customer.code) {
      const existing = await prisma.customer.findUnique({
        where: { companyId_code: { companyId, code: input.code } },
      });

      if (existing) {
        throw new ConflictError('Customer code already exists');
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...input,
        email: input.email || null,
        website: input.website || null,
      },
    });

    const balance = await this.calculateBalance(customerId);

    return {
      ...updated,
      creditLimit: updated.creditLimit ? decimalToNumber(updated.creditLimit) : null,
      balance,
    };
  }

  /**
   * Deactivate customer
   */
  async deactivateCustomer(companyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });
  }

  /**
   * Get customer transactions (invoices and payments)
   */
  async getCustomerTransactions(companyId: string, customerId: string) {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId, companyId },
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          amountDue: true,
          status: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.customerPayment.findMany({
        where: { customerId, companyId },
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
      invoices: invoices.map((inv) => ({
        ...inv,
        total: decimalToNumber(inv.total),
        amountPaid: decimalToNumber(inv.amountPaid),
        amountDue: decimalToNumber(inv.amountDue),
      })),
      payments: payments.map((pmt) => ({
        ...pmt,
        amount: decimalToNumber(pmt.amount),
      })),
    };
  }

  /**
   * Calculate customer outstanding balance
   */
  async calculateBalance(customerId: string): Promise<number> {
    const result = await prisma.invoice.aggregate({
      where: {
        customerId,
        status: { notIn: ['DRAFT', 'VOID'] },
      },
      _sum: {
        amountDue: true,
      },
    });

    return decimalToNumber(result._sum.amountDue);
  }

  /**
   * Generate unique customer code
   */
  private async generateCustomerCode(companyId: string, name: string): Promise<string> {
    const baseCode = generateCode(name, 6);

    // Check if exists and increment
    let code = baseCode;
    let counter = 1;

    while (true) {
      const existing = await prisma.customer.findUnique({
        where: { companyId_code: { companyId, code } },
      });

      if (!existing) break;

      code = `${baseCode}${counter}`;
      counter++;
    }

    return code;
  }
}

export const customerService = new CustomerService();
