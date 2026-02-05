import { prisma } from '../../config/database';
import { JournalSource, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { CreateJournalEntryInput, UpdateJournalEntryInput, JournalQuery, JournalLineInput } from './journal.schema';
import { decimalToNumber } from '../../utils/helpers';
import { getPagination } from '../../middleware/validate';

export class JournalService {
  /**
   * Get journal entries with pagination
   */
  async getJournalEntries(companyId: string, query: JournalQuery) {
    const where: Prisma.JournalEntryWhereInput = {
      companyId,
    };

    if (query.startDate) {
      where.date = { gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.date = { ...where.date as any, lte: new Date(query.endDate) };
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.accountId) {
      where.lines = { some: { accountId: query.accountId } };
    }

    if (query.search) {
      where.OR = [
        { memo: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = getPagination(query.page, query.limit);

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
        skip,
        take,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return {
      entries: entries.map((entry) => this.formatJournalEntry(entry)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  }

  /**
   * Get single journal entry
   */
  async getJournalEntry(companyId: string, entryId: string) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
            customer: {
              select: { id: true, name: true },
            },
            vendor: {
              select: { id: true, name: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundError('Journal entry not found');
    }

    return this.formatJournalEntry(entry);
  }

  /**
   * Create a manual journal entry
   */
  async createJournalEntry(
    companyId: string,
    userId: string,
    input: CreateJournalEntryInput
  ) {
    // Validate double entry
    this.validateDoubleEntry(input.lines);

    // Validate accounts exist and belong to company
    await this.validateAccounts(companyId, input.lines);

    // Get next entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { entryNumber: 'desc' },
    });
    const entryNumber = (lastEntry?.entryNumber || 0) + 1;

    const entry = await prisma.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date: new Date(input.date),
        memo: input.memo,
        reference: input.reference,
        source: JournalSource.MANUAL,
        isAdjusting: input.isAdjusting,
        createdById: userId,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit || 0,
            credit: line.credit || 0,
            memo: line.memo,
            customerId: line.customerId,
            vendorId: line.vendorId,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    return this.formatJournalEntry(entry);
  }

  /**
   * Create journal entry from transaction (internal use)
   */
  async createFromTransaction(
    companyId: string,
    userId: string,
    data: {
      date: Date;
      memo?: string;
      reference?: string;
      source: JournalSource;
      sourceId: string;
      lines: JournalLineInput[];
    }
  ) {
    this.validateDoubleEntry(data.lines);

    const lastEntry = await prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { entryNumber: 'desc' },
    });
    const entryNumber = (lastEntry?.entryNumber || 0) + 1;

    const entry = await prisma.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date: data.date,
        memo: data.memo,
        reference: data.reference,
        source: data.source,
        sourceId: data.sourceId,
        createdById: userId,
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit || 0,
            credit: line.credit || 0,
            memo: line.memo,
            customerId: line.customerId,
            vendorId: line.vendorId,
          })),
        },
      },
    });

    return entry;
  }

  /**
   * Update a journal entry (manual entries only)
   */
  async updateJournalEntry(
    companyId: string,
    entryId: string,
    input: UpdateJournalEntryInput
  ) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
    });

    if (!entry) {
      throw new NotFoundError('Journal entry not found');
    }

    if (entry.source !== JournalSource.MANUAL) {
      throw new BadRequestError('Only manual entries can be edited');
    }

    // Validate lines if provided
    if (input.lines) {
      this.validateDoubleEntry(input.lines);
      await this.validateAccounts(companyId, input.lines);
    }

    const updated = await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        date: input.date ? new Date(input.date) : undefined,
        memo: input.memo,
        reference: input.reference,
        ...(input.lines && {
          lines: {
            deleteMany: {},
            create: input.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit || 0,
              credit: line.credit || 0,
              memo: line.memo,
              customerId: line.customerId,
              vendorId: line.vendorId,
            })),
          },
        }),
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    return this.formatJournalEntry(updated);
  }

  /**
   * Void a journal entry
   */
  async voidJournalEntry(companyId: string, entryId: string) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
    });

    if (!entry) {
      throw new NotFoundError('Journal entry not found');
    }

    if (entry.source !== JournalSource.MANUAL) {
      throw new BadRequestError('Only manual entries can be voided directly');
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { isPosted: false },
    });
  }

  /**
   * Create a reversing entry
   */
  async reverseJournalEntry(
    companyId: string,
    userId: string,
    entryId: string,
    reverseDate?: Date
  ) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundError('Journal entry not found');
    }

    const lastEntry = await prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { entryNumber: 'desc' },
    });
    const entryNumber = (lastEntry?.entryNumber || 0) + 1;

    // Create reversing entry with swapped debits/credits
    const reversingEntry = await prisma.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date: reverseDate || new Date(),
        memo: `Reversal of Entry #${entry.entryNumber}`,
        reference: entry.reference,
        source: JournalSource.MANUAL,
        isReversing: true,
        reversedEntryId: entry.id,
        createdById: userId,
        lines: {
          create: entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: decimalToNumber(line.credit), // Swap
            credit: decimalToNumber(line.debit), // Swap
            memo: line.memo,
            customerId: line.customerId,
            vendorId: line.vendorId,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    return this.formatJournalEntry(reversingEntry);
  }

  /**
   * Get general ledger for an account
   */
  async getGeneralLedger(
    companyId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: Prisma.JournalLineWhereInput = {
      accountId,
      journalEntry: {
        companyId,
        isPosted: true,
      },
    };

    if (startDate || endDate) {
      where.journalEntry = {
        ...where.journalEntry as any,
        date: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      };
    }

    const lines = await prisma.journalLine.findMany({
      where,
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

    // Calculate running balance
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true, openingBalance: true },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    let runningBalance = decimalToNumber(account.openingBalance);
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);

    return lines.map((line) => {
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);

      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        id: line.id,
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
  }

  /**
   * Validate double entry (debits = credits)
   */
  private validateDoubleEntry(lines: JournalLineInput[]) {
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new BadRequestError(
        `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`
      );
    }

    // Each line should have either debit or credit, not both
    for (const line of lines) {
      if ((line.debit || 0) > 0 && (line.credit || 0) > 0) {
        throw new BadRequestError('A line cannot have both debit and credit');
      }
      if ((line.debit || 0) === 0 && (line.credit || 0) === 0) {
        throw new BadRequestError('Each line must have either a debit or credit amount');
      }
    }
  }

  /**
   * Validate all accounts exist and belong to company
   */
  private async validateAccounts(companyId: string, lines: JournalLineInput[]) {
    const accountIds = [...new Set(lines.map((l) => l.accountId))];

    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        companyId,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestError('One or more accounts not found');
    }

    const inactiveAccount = accounts.find((a) => !a.isActive);
    if (inactiveAccount) {
      throw new BadRequestError(`Account ${inactiveAccount.code} is inactive`);
    }
  }

  /**
   * Format journal entry for response
   */
  private formatJournalEntry(entry: any) {
    return {
      ...entry,
      lines: entry.lines?.map((line: any) => ({
        ...line,
        debit: decimalToNumber(line.debit),
        credit: decimalToNumber(line.credit),
      })),
    };
  }
}

export const journalService = new JournalService();
