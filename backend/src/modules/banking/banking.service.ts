import { prisma } from '../../config/database';
import {
  BankTransactionStatus,
  BankTransactionType,
  ReconciliationStatus,
  JournalSource,
  Prisma,
} from '@prisma/client';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  BankTransactionQuery,
  CategorizeTransactionInput,
  MatchTransactionInput,
  StartReconciliationInput,
} from './banking.schema';
import { decimalToNumber, maskAccountNumber } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';
import { journalService } from '../journal/journal.service';

interface ParsedTransaction {
  transactionDate: Date;
  postDate?: Date;
  description: string;
  amount: number;
  type: BankTransactionType;
  fitId?: string;
  checkNumber?: string;
}

export class BankingService {
  /**
   * Get all bank accounts for a company
   */
  async getBankAccounts(companyId: string) {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId },
      include: {
        account: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
      orderBy: { bankName: 'asc' },
    });

    return bankAccounts.map((ba) => ({
      ...ba,
      accountNumber: maskAccountNumber(ba.accountNumber),
      currentBalance: decimalToNumber(ba.currentBalance),
    }));
  }

  /**
   * Get single bank account
   */
  async getBankAccount(companyId: string, bankAccountId: string) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: {
        account: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    return {
      ...bankAccount,
      accountNumber: maskAccountNumber(bankAccount.accountNumber),
      currentBalance: decimalToNumber(bankAccount.currentBalance),
    };
  }

  /**
   * Create bank account
   */
  async createBankAccount(companyId: string, input: CreateBankAccountInput) {
    // Verify the GL account exists and belongs to company
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, companyId },
    });

    if (!account) {
      throw new NotFoundError('GL account not found');
    }

    // Check if GL account is already linked to a bank account
    const existingLink = await prisma.bankAccount.findUnique({
      where: { accountId: input.accountId },
    });

    if (existingLink) {
      throw new ConflictError('GL account is already linked to a bank account');
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId,
        accountId: input.accountId,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        routingNumber: input.routingNumber,
        accountType: input.accountType,
      },
      include: {
        account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      ...bankAccount,
      accountNumber: maskAccountNumber(bankAccount.accountNumber),
      currentBalance: 0,
    };
  }

  /**
   * Update bank account
   */
  async updateBankAccount(
    companyId: string,
    bankAccountId: string,
    input: UpdateBankAccountInput
  ) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });

    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    const updated = await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: input,
    });

    return {
      ...updated,
      accountNumber: maskAccountNumber(updated.accountNumber),
      currentBalance: decimalToNumber(updated.currentBalance),
    };
  }

  /**
   * Get bank transactions
   */
  async getTransactions(companyId: string, bankAccountId: string, query: BankTransactionQuery) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });

    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    const where: Prisma.BankTransactionWhereInput = {
      bankAccountId,
    };

    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.transactionDate = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: {
          categoryAccount: { select: { id: true, code: true, name: true } },
          matchedJournalEntry: {
            select: { id: true, entryNumber: true, memo: true },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: decimalToNumber(t.amount),
      })),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  /**
   * Import transactions from CSV
   */
  async importTransactions(
    companyId: string,
    bankAccountId: string,
    data: string,
    format: 'csv' | 'ofx' | 'qfx' = 'csv'
  ) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });

    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    let transactions: ParsedTransaction[] = [];

    if (format === 'csv') {
      transactions = this.parseCSV(data);
    } else {
      // OFX/QFX parsing would require ofx-js library
      throw new BadRequestError('OFX/QFX import not yet implemented');
    }

    let imported = 0;
    let skipped = 0;

    for (const txn of transactions) {
      // Check for duplicate by fitId
      if (txn.fitId) {
        const existing = await prisma.bankTransaction.findUnique({
          where: {
            bankAccountId_fitId: {
              bankAccountId,
              fitId: txn.fitId,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }
      }

      await prisma.bankTransaction.create({
        data: {
          bankAccountId,
          transactionDate: txn.transactionDate,
          postDate: txn.postDate,
          description: txn.description,
          amount: txn.amount,
          type: txn.type,
          fitId: txn.fitId,
          checkNumber: txn.checkNumber,
          status: BankTransactionStatus.PENDING,
        },
      });

      imported++;
    }

    return { imported, skipped, total: transactions.length };
  }

  /**
   * Categorize a transaction (creates journal entry)
   */
  async categorizeTransaction(
    companyId: string,
    userId: string,
    transactionId: string,
    input: CategorizeTransactionInput
  ) {
    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId },
      include: { bankAccount: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.bankAccount.companyId !== companyId) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status === BankTransactionStatus.RECONCILED) {
      throw new BadRequestError('Cannot modify reconciled transaction');
    }

    // Verify category account
    const categoryAccount = await prisma.account.findFirst({
      where: { id: input.categoryAccountId, companyId },
    });

    if (!categoryAccount) {
      throw new NotFoundError('Category account not found');
    }

    const amount = Math.abs(decimalToNumber(transaction.amount));
    const isDebit = transaction.type === BankTransactionType.DEBIT;

    // Create journal entry
    const journalEntry = await journalService.createFromTransaction(companyId, userId, {
      date: transaction.transactionDate,
      memo: input.memo || transaction.description,
      source: JournalSource.BANK_IMPORT,
      sourceId: transaction.id,
      lines: [
        {
          accountId: transaction.bankAccount.accountId,
          debit: isDebit ? 0 : amount,
          credit: isDebit ? amount : 0,
          memo: transaction.description,
        },
        {
          accountId: input.categoryAccountId,
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          memo: input.memo || transaction.description,
        },
      ],
    });

    // Update transaction
    const updated = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        categoryAccountId: input.categoryAccountId,
        matchedJournalEntryId: journalEntry.id,
        memo: input.memo,
        status: BankTransactionStatus.CATEGORIZED,
      },
    });

    return {
      ...updated,
      amount: decimalToNumber(updated.amount),
    };
  }

  /**
   * Match transaction to existing journal entry
   */
  async matchTransaction(
    companyId: string,
    transactionId: string,
    input: MatchTransactionInput
  ) {
    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId },
      include: { bankAccount: true },
    });

    if (!transaction || transaction.bankAccount.companyId !== companyId) {
      throw new NotFoundError('Transaction not found');
    }

    const journalEntry = await prisma.journalEntry.findFirst({
      where: { id: input.journalEntryId, companyId },
    });

    if (!journalEntry) {
      throw new NotFoundError('Journal entry not found');
    }

    const updated = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        matchedJournalEntryId: input.journalEntryId,
        status: BankTransactionStatus.MATCHED,
      },
    });

    return {
      ...updated,
      amount: decimalToNumber(updated.amount),
    };
  }

  /**
   * Start bank reconciliation
   */
  async startReconciliation(
    companyId: string,
    bankAccountId: string,
    input: StartReconciliationInput
  ) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });

    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    // Check for existing in-progress reconciliation
    const existing = await prisma.bankReconciliation.findFirst({
      where: {
        bankAccountId,
        status: ReconciliationStatus.IN_PROGRESS,
      },
    });

    if (existing) {
      throw new BadRequestError('A reconciliation is already in progress');
    }

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        bankAccountId,
        statementDate: new Date(input.statementDate),
        statementBalance: input.statementBalance,
        status: ReconciliationStatus.IN_PROGRESS,
      },
    });

    return {
      ...reconciliation,
      statementBalance: decimalToNumber(reconciliation.statementBalance),
      reconciledBalance: 0,
    };
  }

  /**
   * Complete reconciliation
   */
  async completeReconciliation(
    companyId: string,
    userId: string,
    reconciliationId: string,
    transactionIds: string[]
  ) {
    const reconciliation = await prisma.bankReconciliation.findUnique({
      where: { id: reconciliationId },
      include: { bankAccount: true },
    });

    if (!reconciliation || reconciliation.bankAccount.companyId !== companyId) {
      throw new NotFoundError('Reconciliation not found');
    }

    if (reconciliation.status === ReconciliationStatus.COMPLETED) {
      throw new BadRequestError('Reconciliation already completed');
    }

    // Calculate reconciled balance
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        id: { in: transactionIds },
        bankAccountId: reconciliation.bankAccountId,
      },
    });

    let reconciledBalance = 0;
    for (const txn of transactions) {
      const amount = decimalToNumber(txn.amount);
      reconciledBalance += txn.type === BankTransactionType.CREDIT ? amount : -amount;
    }

    // Add opening balance
    const lastReconciliation = await prisma.bankReconciliation.findFirst({
      where: {
        bankAccountId: reconciliation.bankAccountId,
        status: ReconciliationStatus.COMPLETED,
      },
      orderBy: { statementDate: 'desc' },
    });

    const openingBalance = lastReconciliation
      ? decimalToNumber(lastReconciliation.reconciledBalance)
      : 0;

    reconciledBalance += openingBalance;

    const statementBalance = decimalToNumber(reconciliation.statementBalance);

    // Check if balanced
    if (Math.abs(reconciledBalance - statementBalance) >= 0.01) {
      throw new BadRequestError(
        `Difference of ${(reconciledBalance - statementBalance).toFixed(2)} - reconciliation not balanced`
      );
    }

    // Mark transactions as reconciled
    await prisma.bankTransaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { status: BankTransactionStatus.RECONCILED },
    });

    // Complete reconciliation
    const updated = await prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        reconciledBalance,
        status: ReconciliationStatus.COMPLETED,
        completedAt: new Date(),
        completedById: userId,
      },
    });

    // Update bank account balance
    await prisma.bankAccount.update({
      where: { id: reconciliation.bankAccountId },
      data: {
        currentBalance: statementBalance,
        lastReconciled: new Date(),
      },
    });

    return {
      ...updated,
      statementBalance: decimalToNumber(updated.statementBalance),
      reconciledBalance: decimalToNumber(updated.reconciledBalance),
    };
  }

  /**
   * Parse CSV data
   */
  private parseCSV(data: string): ParsedTransaction[] {
    const lines = data.trim().split('\n');
    if (lines.length < 2) return [];

    const transactions: ParsedTransaction[] = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));

      if (parts.length < 3) continue;

      // Assume format: Date, Description, Amount
      const dateStr = parts[0];
      const description = parts[1];
      const amount = parseFloat(parts[2]);

      if (isNaN(amount)) continue;

      transactions.push({
        transactionDate: new Date(dateStr),
        description,
        amount: Math.abs(amount),
        type: amount >= 0 ? BankTransactionType.CREDIT : BankTransactionType.DEBIT,
        fitId: `${dateStr}-${description}-${amount}`.replace(/\s/g, ''),
      });
    }

    return transactions;
  }
}

export const bankingService = new BankingService();
