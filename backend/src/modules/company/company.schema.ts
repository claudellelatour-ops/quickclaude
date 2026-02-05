import { z } from 'zod';

export const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).optional();

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  legalName: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
  address: addressSchema,
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal('')),
  baseCurrency: z.string().length(3).default('USD'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
});

export const updateCompanySchema = createCompanySchema.partial();

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'READONLY']).default('MEMBER'),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'READONLY']),
});

export const companySettingsSchema = z.object({
  invoicePrefix: z.string().max(10).optional(),
  invoiceStartNumber: z.number().int().min(1).optional(),
  billPrefix: z.string().max(10).optional(),
  paymentPrefix: z.string().max(10).optional(),
  dateFormat: z.string().max(20).optional(),
  numberFormat: z.enum(['us', 'eu']).optional(),
  defaultPaymentTerms: z.number().int().min(0).max(365).optional(),
  taxEnabled: z.boolean().optional(),
  defaultTaxRate: z.number().min(0).max(1).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
