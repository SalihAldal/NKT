import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export function ok<T>(data: T, requestId?: string): ApiSuccess<T> {
  return { success: true, data, requestId: requestId ?? randomUUID() };
}

export function fail(code: string, message: string, details?: unknown, requestId?: string): ApiError {
  return {
    success: false,
    error: { code, message, details },
    requestId: requestId ?? randomUUID(),
  };
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERR = {
  UNAUTHORIZED: new AppError('UNAUTHORIZED', 'Authentication required', 401),
  FORBIDDEN: new AppError('FORBIDDEN', 'Access denied', 403),
  NOT_FOUND: new AppError('NOT_FOUND', 'Resource not found', 404),
  CONFLICT: new AppError('CONFLICT', 'Resource conflict', 409),
  VALIDATION: (msg: string, details?: unknown) => new AppError('VALIDATION_ERROR', msg, 422, details),
  RATE_LIMIT: new AppError('RATE_LIMIT', 'Too many requests', 429),
  INTERNAL: new AppError('INTERNAL_ERROR', 'Internal server error', 500),
} as const;

export function getRequestId(req: FastifyRequest): string {
  return (req.headers['x-request-id'] as string) ?? req.id;
}

export function sendError(reply: FastifyReply, err: AppError, requestId: string) {
  return reply.status(err.statusCode).send(fail(err.code, err.message, err.details, requestId));
}
