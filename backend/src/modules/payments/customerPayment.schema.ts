import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const paymentAllocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
});

export const createCustomerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  date: z.string().datetime(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.OTHER),
  reference: z.string().max(100).optional(),
  memo: z.string().max(500).optional(),
  bankAccountId: z.string().uuid().optional(),
  allocations: z.array(paymentAllocationSchema).optional(),
});

export const customerPaymentQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type PaymentAllocationInput = z.infer<typeof paymentAllocationSchema>;
export type CreateCustomerPaymentInput = z.infer<typeof createCustomerPaymentSchema>;
export type CustomerPaymentQuery = z.infer<typeof customerPaymentQuerySchema>;
