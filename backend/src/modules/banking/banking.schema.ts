import { z } from 'zod';
import { BankAccountType, BankTransactionStatus } from '@prisma/client';

export const createBankAccountSchema = z.object({
  accountId: z.string().uuid(), // Link to chart of accounts
  bankName: z.string().min(1).max(200),
  accountNumber: z.string().min(4).max(20),
  routingNumber: z.string().max(20).optional(),
  accountType: z.nativeEnum(BankAccountType).default(BankAccountType.CHECKING),
});

export const updateBankAccountSchema = z.object({
  bankName: z.string().min(1).max(200).optional(),
  routingNumber: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const importTransactionsSchema = z.object({
  format: z.enum(['csv', 'ofx', 'qfx']).default('csv'),
  data: z.string(), // Base64 encoded file or raw CSV
});

export const categorizeTransactionSchema = z.object({
  categoryAccountId: z.string().uuid(),
  memo: z.string().max(500).optional(),
});

export const matchTransactionSchema = z.object({
  journalEntryId: z.string().uuid(),
});

export const startReconciliationSchema = z.object({
  statementDate: z.string().datetime(),
  statementBalance: z.number(),
});

export const completeReconciliationSchema = z.object({
  transactionIds: z.array(z.string().uuid()),
});

export const bankTransactionQuerySchema = z.object({
  status: z.nativeEnum(BankTransactionStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('100'),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
export type CategorizeTransactionInput = z.infer<typeof categorizeTransactionSchema>;
export type MatchTransactionInput = z.infer<typeof matchTransactionSchema>;
export type StartReconciliationInput = z.infer<typeof startReconciliationSchema>;
export type CompleteReconciliationInput = z.infer<typeof completeReconciliationSchema>;
export type BankTransactionQuery = z.infer<typeof bankTransactionQuerySchema>;
