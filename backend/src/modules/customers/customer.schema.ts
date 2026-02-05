import { z } from 'zod';

export const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const createCustomerSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional().or(z.literal('')),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  paymentTerms: z.number().int().min(0).max(365).default(30),
  creditLimit: z.number().min(0).optional(),
  taxExempt: z.boolean().default(false),
  taxExemptNumber: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  customFields: z.record(z.any()).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
