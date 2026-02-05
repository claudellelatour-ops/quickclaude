import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';

export const invoiceLineSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRateId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid(),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  invoiceNumber: z.string().max(50).optional(),
  date: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  terms: z.number().int().min(0).max(365).default(30),
  memo: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line required'),
});

export const updateInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  date: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  terms: z.number().int().min(0).max(365).optional(),
  memo: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(invoiceLineSchema).min(1).optional(),
});

export const invoiceQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
