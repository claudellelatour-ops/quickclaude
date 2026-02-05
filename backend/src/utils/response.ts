import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message: string;
    errors?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number }
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  };
  return res.status(200).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  errors?: Record<string, string[]>
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      errors,
    },
  };
  return res.status(statusCode).json(response);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
