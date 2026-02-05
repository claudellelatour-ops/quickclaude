import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../utils/errors';
import { sendError } from '../utils/response';
import { isDevelopment } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response {
  // Log error in development
  if (isDevelopment) {
    console.error('Error:', err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(e.message);
    });
    return sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', errors);
  }

  // Handle custom validation errors
  if (err instanceof ValidationError) {
    return sendError(res, err.message, err.statusCode, err.code, err.errors);
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        return sendError(
          res,
          `A record with this ${target} already exists`,
          409,
          'DUPLICATE_ENTRY'
        );
      case 'P2025':
        // Record not found
        return sendError(res, 'Record not found', 404, 'NOT_FOUND');
      case 'P2003':
        // Foreign key constraint violation
        return sendError(
          res,
          'Related record not found',
          400,
          'FOREIGN_KEY_VIOLATION'
        );
      default:
        return sendError(
          res,
          'Database error',
          500,
          `DB_ERROR_${err.code}`
        );
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid data provided', 400, 'VALIDATION_ERROR');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Default error response
  const message = isDevelopment ? err.message : 'Internal server error';
  return sendError(res, message, 500, 'INTERNAL_ERROR');
}

// Catch async errors wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
