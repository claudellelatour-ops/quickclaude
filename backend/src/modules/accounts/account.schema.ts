import { z } from 'zod';
import { AccountType, AccountSubType } from '@prisma/client';

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(AccountType),
  subType: z.nativeEnum(AccountSubType),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional(),
  openingBalance: z.number().default(0),
  openingBalanceDate: z.string().datetime().optional(),
});

export const updateAccountSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const accountQuerySchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  subType: z.nativeEnum(AccountSubType).optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  search: z.string().optional(),
  flat: z.string().transform((v) => v === 'true').optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountQuery = z.infer<typeof accountQuerySchema>;

// Default chart of accounts templates
export const defaultChartOfAccounts = {
  service: [
    // Assets
    { code: '1000', name: 'Cash', type: AccountType.ASSET, subType: AccountSubType.CASH, isSystemAccount: true },
    { code: '1100', name: 'Checking Account', type: AccountType.ASSET, subType: AccountSubType.BANK },
    { code: '1200', name: 'Savings Account', type: AccountType.ASSET, subType: AccountSubType.BANK },
    { code: '1300', name: 'Accounts Receivable', type: AccountType.ASSET, subType: AccountSubType.ACCOUNTS_RECEIVABLE, isSystemAccount: true },
    { code: '1400', name: 'Undeposited Funds', type: AccountType.ASSET, subType: AccountSubType.OTHER_ASSET, isSystemAccount: true },
    { code: '1500', name: 'Prepaid Expenses', type: AccountType.ASSET, subType: AccountSubType.OTHER_ASSET },
    { code: '1600', name: 'Office Equipment', type: AccountType.ASSET, subType: AccountSubType.FIXED_ASSET },
    { code: '1650', name: 'Accumulated Depreciation - Equipment', type: AccountType.ASSET, subType: AccountSubType.FIXED_ASSET },

    // Liabilities
    { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY, subType: AccountSubType.ACCOUNTS_PAYABLE, isSystemAccount: true },
    { code: '2100', name: 'Credit Card', type: AccountType.LIABILITY, subType: AccountSubType.CREDIT_CARD },
    { code: '2200', name: 'Sales Tax Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, isSystemAccount: true },
    { code: '2300', name: 'Payroll Liabilities', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY },
    { code: '2400', name: 'Unearned Revenue', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY },
    { code: '2500', name: 'Line of Credit', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY },
    { code: '2600', name: 'Long-term Debt', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY },

    // Equity
    { code: '3000', name: 'Owner\'s Equity', type: AccountType.EQUITY, subType: AccountSubType.OWNERS_EQUITY, isSystemAccount: true },
    { code: '3100', name: 'Owner\'s Draws', type: AccountType.EQUITY, subType: AccountSubType.OWNERS_EQUITY },
    { code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, subType: AccountSubType.RETAINED_EARNINGS, isSystemAccount: true },
    { code: '3900', name: 'Opening Balance Equity', type: AccountType.EQUITY, subType: AccountSubType.OWNERS_EQUITY, isSystemAccount: true },

    // Revenue
    { code: '4000', name: 'Service Revenue', type: AccountType.REVENUE, subType: AccountSubType.INCOME },
    { code: '4100', name: 'Consulting Revenue', type: AccountType.REVENUE, subType: AccountSubType.INCOME },
    { code: '4200', name: 'Sales Revenue', type: AccountType.REVENUE, subType: AccountSubType.INCOME },
    { code: '4900', name: 'Other Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_INCOME },
    { code: '4910', name: 'Interest Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_INCOME },
    { code: '4920', name: 'Discounts Taken', type: AccountType.REVENUE, subType: AccountSubType.OTHER_INCOME },

    // Expenses
    { code: '5000', name: 'Cost of Services', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD },
    { code: '5100', name: 'Subcontractor Expense', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD },
    { code: '6000', name: 'Advertising & Marketing', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6100', name: 'Bank Charges', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6200', name: 'Depreciation Expense', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6300', name: 'Insurance', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6400', name: 'Interest Expense', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6500', name: 'Office Supplies', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6600', name: 'Professional Fees', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6700', name: 'Rent Expense', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6800', name: 'Repairs & Maintenance', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '6900', name: 'Telephone & Internet', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7000', name: 'Travel & Entertainment', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7100', name: 'Utilities', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7200', name: 'Wages & Salaries', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7300', name: 'Payroll Taxes', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7400', name: 'Employee Benefits', type: AccountType.EXPENSE, subType: AccountSubType.EXPENSE },
    { code: '7900', name: 'Miscellaneous Expense', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE },
  ],
};
