import { z } from 'zod';
import { JournalSource } from '@prisma/client';

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  memo: z.string().max(500).optional(),
  customerId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
});

export const createJournalEntrySchema = z.object({
  date: z.string().datetime(),
  memo: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
  isAdjusting: z.boolean().default(false),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export const updateJournalEntrySchema = z.object({
  date: z.string().datetime().optional(),
  memo: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
  lines: z.array(journalLineSchema).min(2).optional(),
}).refine(
  (data) => {
    if (!data.lines) return true;
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export const journalQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  accountId: z.string().uuid().optional(),
  source: z.nativeEnum(JournalSource).optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalQuery = z.infer<typeof journalQuerySchema>;
