import { z } from 'zod';
import { BillStatus } from '@prisma/client';

export const billLineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  taxRateId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  isBillable: z.boolean().default(false),
});

export const createBillSchema = z.object({
  vendorId: z.string().uuid(),
  billNumber: z.string().max(50).optional(),
  vendorRef: z.string().max(100).optional(),
  date: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  terms: z.number().int().min(0).max(365).default(30),
  memo: z.string().max(2000).optional(),
  lines: z.array(billLineSchema).min(1, 'At least one line required'),
});

export const updateBillSchema = z.object({
  vendorId: z.string().uuid().optional(),
  vendorRef: z.string().max(100).optional(),
  date: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  terms: z.number().int().min(0).max(365).optional(),
  memo: z.string().max(2000).optional(),
  lines: z.array(billLineSchema).min(1).optional(),
});

export const billQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  status: z.nativeEnum(BillStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type BillLineInput = z.infer<typeof billLineSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type BillQuery = z.infer<typeof billQuerySchema>;
