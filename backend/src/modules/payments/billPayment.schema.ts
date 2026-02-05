import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const billPaymentAllocationSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().positive(),
});

export const createBillPaymentSchema = z.object({
  vendorId: z.string().uuid(),
  date: z.string().datetime(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CHECK),
  bankAccountId: z.string().uuid().optional(),
  checkNumber: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  memo: z.string().max(500).optional(),
  allocations: z.array(billPaymentAllocationSchema).optional(),
});

export const billPaymentQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type BillPaymentAllocationInput = z.infer<typeof billPaymentAllocationSchema>;
export type CreateBillPaymentInput = z.infer<typeof createBillPaymentSchema>;
export type BillPaymentQuery = z.infer<typeof billPaymentQuerySchema>;
