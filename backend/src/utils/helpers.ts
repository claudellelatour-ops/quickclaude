import { Decimal } from '@prisma/client/runtime/library';

/**
 * Round a number to specified decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Convert Decimal to number
 */
export function decimalToNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value.toNumber();
}

/**
 * Check if two numbers are equal within a tolerance (for floating point comparison)
 */
export function areEqual(a: number, b: number, tolerance: number = 0.01): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Generate a sequential number with prefix
 */
export function generateNumber(prefix: string, sequence: number, padding: number = 6): string {
  return `${prefix}${String(sequence).padStart(padding, '0')}`;
}

/**
 * Parse a date string to Date object (handles various formats)
 */
export function parseDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr);
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate due date based on terms (days)
 */
export function calculateDueDate(date: Date, terms: number): Date {
  return addDays(date, terms);
}

/**
 * Mask sensitive data like account numbers
 */
export function maskAccountNumber(accountNumber: string, visibleDigits: number = 4): string {
  if (accountNumber.length <= visibleDigits) return accountNumber;
  const masked = '*'.repeat(accountNumber.length - visibleDigits);
  return masked + accountNumber.slice(-visibleDigits);
}

/**
 * Slugify a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique code from name
 */
export function generateCode(name: string, maxLength: number = 10): string {
  return slugify(name).toUpperCase().substring(0, maxLength);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specified keys from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omit specified keys from an object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}
