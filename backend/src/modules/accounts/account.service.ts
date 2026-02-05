import { prisma } from '../../config/database';
import { AccountType, AccountSubType, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import { CreateAccountInput, UpdateAccountInput, AccountQuery, defaultChartOfAccounts } from './account.schema';
import { decimalToNumber } from '../../utils/helpers';

interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  parentId: string | null;
  description: string | null;
  isSystemAccount: boolean;
  isActive: boolean;
  balance: number;
  children?: AccountWithBalance[];
}

export class AccountService {
  /**
   * Get all accounts for a company
   */
  async getAccounts(companyId: string, query: AccountQuery): Promise<AccountWithBalance[]> {
    const where: Prisma.AccountWhereInput = {
      companyId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.subType) {
      where.subType = query.subType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    // Calculate balances
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        const balance = await this.calculateAccountBalance(account.id, account.type);
        return {
          ...account,
          openingBalance: decimalToNumber(account.openingBalance),
          balance,
        };
      })
    );

    // Return flat or tree structure
    if (query.flat) {
      return accountsWithBalances;
    }

    return this.buildAccountTree(accountsWithBalances);
  }

  /**
   * Get single account with balance
   */
  async getAccount(companyId: string, accountId: string): Promise<AccountWithBalance> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const balance = await this.calculateAccountBalance(account.id, account.type);

    return {
      ...account,
      openingBalance: decimalToNumber(account.openingBalance),
      balance,
    };
  }

  /**
   * Create a new account
   */
  async createAccount(companyId: string, input: CreateAccountInput) {
    // Check for duplicate code
    const existing = await prisma.account.findUnique({
      where: {
        companyId_code: { companyId, code: input.code },
      },
    });

    if (existing) {
      throw new ConflictError('Account code already exists');
    }

    // Validate parent account
    if (input.parentId) {
      const parent = await prisma.account.findFirst({
        where: { id: input.parentId, companyId },
      });

      if (!parent) {
        throw new BadRequestError('Parent account not found');
      }

      if (parent.type !== input.type) {
        throw new BadRequestError('Parent account must be of the same type');
      }
    }

    const account = await prisma.account.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        type: input.type,
        subType: input.subType,
        parentId: input.parentId,
        description: input.description,
        openingBalance: input.openingBalance,
        openingBalanceDate: input.openingBalanceDate ? new Date(input.openingBalanceDate) : null,
      },
    });

    return {
      ...account,
      openingBalance: decimalToNumber(account.openingBalance),
      balance: decimalToNumber(account.openingBalance),
    };
  }

  /**
   * Update an account
   */
  async updateAccount(companyId: string, accountId: string, input: UpdateAccountInput) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Cannot modify system accounts' key properties
    if (account.isSystemAccount && (input.code || input.isActive === false)) {
      throw new BadRequestError('Cannot modify system account code or deactivate it');
    }

    // Check code uniqueness if changing
    if (input.code && input.code !== account.code) {
      const existing = await prisma.account.findUnique({
        where: {
          companyId_code: { companyId, code: input.code },
        },
      });

      if (existing) {
        throw new ConflictError('Account code already exists');
      }
    }

    // Validate parent account
    if (input.parentId) {
      if (input.parentId === accountId) {
        throw new BadRequestError('Account cannot be its own parent');
      }

      const parent = await prisma.account.findFirst({
        where: { id: input.parentId, companyId },
      });

      if (!parent) {
        throw new BadRequestError('Parent account not found');
      }

      if (parent.type !== account.type) {
        throw new BadRequestError('Parent account must be of the same type');
      }

      // Check for circular reference
      let currentParent = parent;
      while (currentParent.parentId) {
        if (currentParent.parentId === accountId) {
          throw new BadRequestError('Circular parent reference detected');
        }
        const next = await prisma.account.findUnique({
          where: { id: currentParent.parentId },
        });
        if (!next) break;
        currentParent = next;
      }
    }

    const updated = await prisma.account.update({
      where: { id: accountId },
      data: input,
    });

    const balance = await this.calculateAccountBalance(updated.id, updated.type);

    return {
      ...updated,
      openingBalance: decimalToNumber(updated.openingBalance),
      balance,
    };
  }

  /**
   * Deactivate an account (soft delete)
   */
  async deactivateAccount(companyId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.isSystemAccount) {
      throw new BadRequestError('Cannot deactivate system account');
    }

    // Check if account has transactions
    const hasTransactions = await prisma.journalLine.findFirst({
      where: { accountId },
    });

    if (hasTransactions) {
      // Soft delete - just deactivate
      await prisma.account.update({
        where: { id: accountId },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no transactions
      await prisma.account.delete({
        where: { id: accountId },
      });
    }
  }

  /**
   * Import default chart of accounts
   */
  async importDefaultChart(companyId: string, template: keyof typeof defaultChartOfAccounts = 'service') {
    const accounts = defaultChartOfAccounts[template];

    // Check if company already has accounts
    const existingCount = await prisma.account.count({
      where: { companyId },
    });

    if (existingCount > 0) {
      throw new BadRequestError('Company already has accounts. Cannot import default chart.');
    }

    // Create all accounts
    const created = await prisma.account.createMany({
      data: accounts.map((acc) => ({
        companyId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subType: acc.subType,
        isSystemAccount: acc.isSystemAccount || false,
      })),
    });

    return { count: created.count };
  }

  /**
   * Calculate account balance from journal entries
   */
  async calculateAccountBalance(accountId: string, accountType: AccountType): Promise<number> {
    const result = await prisma.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: { isPosted: true },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const debits = decimalToNumber(result._sum.debit);
    const credits = decimalToNumber(result._sum.credit);

    // Get opening balance
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { openingBalance: true },
    });

    const openingBalance = account ? decimalToNumber(account.openingBalance) : 0;

    // Calculate balance based on account type
    // Assets and Expenses: debit increases, credit decreases
    // Liabilities, Equity, Revenue: credit increases, debit decreases
    if ([AccountType.ASSET, AccountType.EXPENSE].includes(accountType)) {
      return openingBalance + debits - credits;
    }
    return openingBalance + credits - debits;
  }

  /**
   * Get system account by subtype
   */
  async getSystemAccount(companyId: string, subType: AccountSubType) {
    const account = await prisma.account.findFirst({
      where: {
        companyId,
        subType,
        isSystemAccount: true,
      },
    });

    if (!account) {
      throw new NotFoundError(`System account not found: ${subType}`);
    }

    return account;
  }

  /**
   * Build hierarchical tree from flat list
   */
  private buildAccountTree(accounts: AccountWithBalance[]): AccountWithBalance[] {
    const accountMap = new Map<string, AccountWithBalance>();
    const rootAccounts: AccountWithBalance[] = [];

    // First pass: create map
    accounts.forEach((account) => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    // Second pass: build tree
    accounts.forEach((account) => {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        const parent = accountMap.get(account.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        rootAccounts.push(node);
      }
    });

    return rootAccounts;
  }
}

export const accountService = new AccountService();
