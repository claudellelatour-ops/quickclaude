import { z } from 'zod';

export const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const createVendorSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: addressSchema.optional(),
  paymentTerms: z.number().int().min(0).max(365).default(30),
  defaultExpenseAccountId: z.string().uuid().optional(),
  taxId: z.string().max(50).optional(),
  is1099Eligible: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
  customFields: z.record(z.any()).optional(),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const vendorQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  is1099Eligible: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorQuery = z.infer<typeof vendorQuerySchema>;
