import { prisma } from '../../config/database';
import { AccountType, InvoiceStatus, BillStatus } from '@prisma/client';
import { decimalToNumber, addDays } from '../../utils/helpers';

interface ReportAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
  compareBalance?: number;
}

interface AgingBucket {
  period: string;
  amount: number;
  count: number;
}

interface AgingDetail {
  id: string;
  number: string;
  name: string;
  date: Date;
  dueDate: Date;
  total: number;
  amountDue: number;
  daysOverdue: number;
  bucket: string;
}

export class ReportService {
  /**
   * Profit & Loss Statement
   */
  async getProfitAndLoss(
    companyId: string,
    startDate: Date,
    endDate: Date,
    compareStartDate?: Date,
    compareEndDate?: Date
  ) {
    const revenueAccounts = await this.getAccountBalances(
      companyId,
      AccountType.REVENUE,
      startDate,
      endDate
    );

    const expenseAccounts = await this.getAccountBalances(
      companyId,
      AccountType.EXPENSE,
      startDate,
      endDate
    );

    let compareRevenue: ReportAccount[] = [];
    let compareExpense: ReportAccount[] = [];

    if (compareStartDate && compareEndDate) {
      compareRevenue = await this.getAccountBalances(
        companyId,
        AccountType.REVENUE,
        compareStartDate,
        compareEndDate
      );
      compareExpense = await this.getAccountBalances(
        companyId,
        AccountType.EXPENSE,
        compareStartDate,
        compareEndDate
      );

      // Merge compare balances
      revenueAccounts.forEach((acc) => {
        const compare = compareRevenue.find((c) => c.id === acc.id);
        acc.compareBalance = compare?.balance || 0;
      });
      expenseAccounts.forEach((acc) => {
        const compare = compareExpense.find((c) => c.id === acc.id);
        acc.compareBalance = compare?.balance || 0;
      });
    }

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    const compareTotalRevenue = revenueAccounts.reduce(
      (sum, a) => sum + (a.compareBalance || 0),
      0
    );
    const compareTotalExpenses = expenseAccounts.reduce(
      (sum, a) => sum + (a.compareBalance || 0),
      0
    );
    const compareNetIncome = compareTotalRevenue - compareTotalExpenses;

    return {
      period: { startDate, endDate },
      comparePeriod: compareStartDate ? { startDate: compareStartDate, endDate: compareEndDate } : undefined,
      revenue: {
        accounts: revenueAccounts,
        total: totalRevenue,
        compareTotal: compareStartDate ? compareTotalRevenue : undefined,
      },
      expenses: {
        accounts: expenseAccounts,
        total: totalExpenses,
        compareTotal: compareStartDate ? compareTotalExpenses : undefined,
      },
      netIncome,
      compareNetIncome: compareStartDate ? compareNetIncome : undefined,
    };
  }

  /**
   * Balance Sheet
   */
  async getBalanceSheet(companyId: string, asOfDate: Date, compareAsOfDate?: Date) {
    const assets = await this.getAccountBalancesAsOf(companyId, AccountType.ASSET, asOfDate);
    const liabilities = await this.getAccountBalancesAsOf(
      companyId,
      AccountType.LIABILITY,
      asOfDate
    );
    const equity = await this.getAccountBalancesAsOf(companyId, AccountType.EQUITY, asOfDate);

    // Calculate retained earnings (net income to date)
    const retainedEarnings = await this.calculateRetainedEarnings(companyId, asOfDate);

    if (compareAsOfDate) {
      const compareAssets = await this.getAccountBalancesAsOf(
        companyId,
        AccountType.ASSET,
        compareAsOfDate
      );
      const compareLiabilities = await this.getAccountBalancesAsOf(
        companyId,
        AccountType.LIABILITY,
        compareAsOfDate
      );
      const compareEquity = await this.getAccountBalancesAsOf(
        companyId,
        AccountType.EQUITY,
        compareAsOfDate
      );

      assets.forEach((acc) => {
        const compare = compareAssets.find((c) => c.id === acc.id);
        acc.compareBalance = compare?.balance || 0;
      });
      liabilities.forEach((acc) => {
        const compare = compareLiabilities.find((c) => c.id === acc.id);
        acc.compareBalance = compare?.balance || 0;
      });
      equity.forEach((acc) => {
        const compare = compareEquity.find((c) => c.id === acc.id);
        acc.compareBalance = compare?.balance || 0;
      });
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + retainedEarnings;

    return {
      asOfDate,
      compareAsOfDate,
      assets: {
        accounts: assets,
        total: totalAssets,
      },
      liabilities: {
        accounts: liabilities,
        total: totalLiabilities,
      },
      equity: {
        accounts: equity,
        retainedEarnings,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    };
  }

  /**
   * Trial Balance
   */
  async getTrialBalance(companyId: string, asOfDate: Date) {
    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const balances = await Promise.all(
      accounts.map(async (account) => {
        const balance = await this.calculateAccountBalanceAsOf(account.id, account.type, asOfDate);
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          debit: isDebitNormal && balance > 0 ? balance : !isDebitNormal && balance < 0 ? -balance : 0,
          credit: !isDebitNormal && balance > 0 ? balance : isDebitNormal && balance < 0 ? -balance : 0,
        };
      })
    );

    // Filter out zero balances
    const nonZeroBalances = balances.filter((b) => b.debit > 0 || b.credit > 0);

    const totalDebits = nonZeroBalances.reduce((sum, b) => sum + b.debit, 0);
    const totalCredits = nonZeroBalances.reduce((sum, b) => sum + b.credit, 0);

    return {
      asOfDate,
      accounts: nonZeroBalances,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  /**
   * AR Aging Report
   */
  async getARAgingReport(companyId: string, asOfDate: Date, agingPeriods: number[] = [30, 60, 90, 120]) {
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        dueDate: { lte: asOfDate },
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Build aging buckets
    const buckets = this.buildAgingBuckets(agingPeriods);
    const details: AgingDetail[] = [];

    const customerTotals = new Map<string, { name: string; buckets: number[]; total: number }>();

    for (const invoice of invoices) {
      const amountDue = decimalToNumber(invoice.amountDue);
      if (amountDue <= 0) continue;

      const daysOverdue = Math.floor(
        (asOfDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const bucketIndex = this.getBucketIndex(daysOverdue, agingPeriods);
      const bucketLabel = buckets[bucketIndex].period;

      details.push({
        id: invoice.id,
        number: invoice.invoiceNumber,
        name: invoice.customer.name,
        date: invoice.date,
        dueDate: invoice.dueDate,
        total: decimalToNumber(invoice.total),
        amountDue,
        daysOverdue,
        bucket: bucketLabel,
      });

      // Add to bucket totals
      buckets[bucketIndex].amount += amountDue;
      buckets[bucketIndex].count++;

      // Track by customer
      if (!customerTotals.has(invoice.customerId)) {
        customerTotals.set(invoice.customerId, {
          name: invoice.customer.name,
          buckets: new Array(buckets.length).fill(0),
          total: 0,
        });
      }
      const customer = customerTotals.get(invoice.customerId)!;
      customer.buckets[bucketIndex] += amountDue;
      customer.total += amountDue;
    }

    const totalAmount = buckets.reduce((sum, b) => sum + b.amount, 0);

    return {
      asOfDate,
      agingPeriods,
      summary: {
        buckets,
        total: totalAmount,
      },
      byCustomer: Array.from(customerTotals.values()).sort((a, b) => b.total - a.total),
      details,
    };
  }

  /**
   * AP Aging Report
   */
  async getAPAgingReport(companyId: string, asOfDate: Date, agingPeriods: number[] = [30, 60, 90, 120]) {
    const bills = await prisma.bill.findMany({
      where: {
        companyId,
        status: { in: [BillStatus.RECEIVED, BillStatus.PARTIAL, BillStatus.OVERDUE] },
        dueDate: { lte: asOfDate },
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = this.buildAgingBuckets(agingPeriods);
    const details: AgingDetail[] = [];

    const vendorTotals = new Map<string, { name: string; buckets: number[]; total: number }>();

    for (const bill of bills) {
      const amountDue = decimalToNumber(bill.amountDue);
      if (amountDue <= 0) continue;

      const daysOverdue = Math.floor(
        (asOfDate.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const bucketIndex = this.getBucketIndex(daysOverdue, agingPeriods);
      const bucketLabel = buckets[bucketIndex].period;

      details.push({
        id: bill.id,
        number: bill.billNumber,
        name: bill.vendor.name,
        date: bill.date,
        dueDate: bill.dueDate,
        total: decimalToNumber(bill.total),
        amountDue,
        daysOverdue,
        bucket: bucketLabel,
      });

      buckets[bucketIndex].amount += amountDue;
      buckets[bucketIndex].count++;

      if (!vendorTotals.has(bill.vendorId)) {
        vendorTotals.set(bill.vendorId, {
          name: bill.vendor.name,
          buckets: new Array(buckets.length).fill(0),
          total: 0,
        });
      }
      const vendor = vendorTotals.get(bill.vendorId)!;
      vendor.buckets[bucketIndex] += amountDue;
      vendor.total += amountDue;
    }

    const totalAmount = buckets.reduce((sum, b) => sum + b.amount, 0);

    return {
      asOfDate,
      agingPeriods,
      summary: {
        buckets,
        total: totalAmount,
      },
      byVendor: Array.from(vendorTotals.values()).sort((a, b) => b.total - a.total),
      details,
    };
  }

  /**
   * General Ledger Report
   */
  async getGeneralLedger(
    companyId: string,
    startDate: Date,
    endDate: Date,
    accountId?: string
  ) {
    const where: any = {
      companyId,
      isActive: true,
    };

    if (accountId) {
      where.id = accountId;
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    const ledger = await Promise.all(
      accounts.map(async (account) => {
        // Get opening balance
        const openingBalance = await this.calculateAccountBalanceAsOf(
          account.id,
          account.type,
          addDays(startDate, -1)
        );

        // Get transactions in period
        const lines = await prisma.journalLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: {
              isPosted: true,
              date: { gte: startDate, lte: endDate },
            },
          },
          include: {
            journalEntry: {
              select: {
                id: true,
                entryNumber: true,
                date: true,
                memo: true,
                reference: true,
                source: true,
              },
            },
          },
          orderBy: [
            { journalEntry: { date: 'asc' } },
            { journalEntry: { entryNumber: 'asc' } },
          ],
        });

        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
        let runningBalance = openingBalance;

        const transactions = lines.map((line) => {
          const debit = decimalToNumber(line.debit);
          const credit = decimalToNumber(line.credit);

          if (isDebitNormal) {
            runningBalance += debit - credit;
          } else {
            runningBalance += credit - debit;
          }

          return {
            date: line.journalEntry.date,
            entryNumber: line.journalEntry.entryNumber,
            memo: line.memo || line.journalEntry.memo,
            reference: line.journalEntry.reference,
            source: line.journalEntry.source,
            debit,
            credit,
            balance: runningBalance,
          };
        });

        return {
          account: {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
          },
          openingBalance,
          transactions,
          closingBalance: runningBalance,
        };
      })
    );

    return {
      period: { startDate, endDate },
      accounts: ledger.filter((l) => l.transactions.length > 0 || l.openingBalance !== 0),
    };
  }

  // Helper methods

  private async getAccountBalances(
    companyId: string,
    type: AccountType,
    startDate: Date,
    endDate: Date
  ): Promise<ReportAccount[]> {
    const accounts = await prisma.account.findMany({
      where: { companyId, type, isActive: true },
      orderBy: { code: 'asc' },
    });

    return Promise.all(
      accounts.map(async (account) => {
        const result = await prisma.journalLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              isPosted: true,
              date: { gte: startDate, lte: endDate },
            },
          },
          _sum: { debit: true, credit: true },
        });

        const debits = decimalToNumber(result._sum.debit);
        const credits = decimalToNumber(result._sum.credit);

        const balance =
          type === AccountType.REVENUE || type === AccountType.LIABILITY || type === AccountType.EQUITY
            ? credits - debits
            : debits - credits;

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          balance,
        };
      })
    );
  }

  private async getAccountBalancesAsOf(
    companyId: string,
    type: AccountType,
    asOfDate: Date
  ): Promise<ReportAccount[]> {
    const accounts = await prisma.account.findMany({
      where: { companyId, type, isActive: true },
      orderBy: { code: 'asc' },
    });

    return Promise.all(
      accounts.map(async (account) => {
        const balance = await this.calculateAccountBalanceAsOf(account.id, account.type, asOfDate);
        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          balance,
        };
      })
    );
  }

  private async calculateAccountBalanceAsOf(
    accountId: string,
    type: AccountType,
    asOfDate: Date
  ): Promise<number> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    const openingBalance = account ? decimalToNumber(account.openingBalance) : 0;

    const result = await prisma.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          isPosted: true,
          date: { lte: asOfDate },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const debits = decimalToNumber(result._sum.debit);
    const credits = decimalToNumber(result._sum.credit);

    if ([AccountType.ASSET, AccountType.EXPENSE].includes(type)) {
      return openingBalance + debits - credits;
    }
    return openingBalance + credits - debits;
  }

  private async calculateRetainedEarnings(companyId: string, asOfDate: Date): Promise<number> {
    // Revenue - Expenses to date
    const revenueResult = await prisma.journalLine.aggregate({
      where: {
        account: { companyId, type: AccountType.REVENUE },
        journalEntry: { isPosted: true, date: { lte: asOfDate } },
      },
      _sum: { debit: true, credit: true },
    });

    const expenseResult = await prisma.journalLine.aggregate({
      where: {
        account: { companyId, type: AccountType.EXPENSE },
        journalEntry: { isPosted: true, date: { lte: asOfDate } },
      },
      _sum: { debit: true, credit: true },
    });

    const revenue =
      decimalToNumber(revenueResult._sum.credit) - decimalToNumber(revenueResult._sum.debit);
    const expenses =
      decimalToNumber(expenseResult._sum.debit) - decimalToNumber(expenseResult._sum.credit);

    return revenue - expenses;
  }

  private buildAgingBuckets(periods: number[]): AgingBucket[] {
    const buckets: AgingBucket[] = [{ period: 'Current', amount: 0, count: 0 }];

    for (let i = 0; i < periods.length; i++) {
      const start = i === 0 ? 1 : periods[i - 1] + 1;
      const end = periods[i];
      buckets.push({ period: `${start}-${end} days`, amount: 0, count: 0 });
    }

    buckets.push({ period: `Over ${periods[periods.length - 1]} days`, amount: 0, count: 0 });

    return buckets;
  }

  private getBucketIndex(daysOverdue: number, periods: number[]): number {
    if (daysOverdue <= 0) return 0;

    for (let i = 0; i < periods.length; i++) {
      if (daysOverdue <= periods[i]) return i + 1;
    }

    return periods.length + 1;
  }
}

export const reportService = new ReportService();
