import { z } from 'zod';

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  compareStartDate: z.string().datetime().optional(),
  compareEndDate: z.string().datetime().optional(),
});

export const asOfDateSchema = z.object({
  asOfDate: z.string().datetime(),
  compareAsOfDate: z.string().datetime().optional(),
});

export const agingReportSchema = z.object({
  asOfDate: z.string().datetime(),
  agingPeriods: z.array(z.number().int().positive()).optional().default([30, 60, 90, 120]),
});

export const generalLedgerSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  accountId: z.string().uuid().optional(),
});

export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type AsOfDateInput = z.infer<typeof asOfDateSchema>;
export type AgingReportInput = z.infer<typeof agingReportSchema>;
export type GeneralLedgerInput = z.infer<typeof generalLedgerSchema>;
