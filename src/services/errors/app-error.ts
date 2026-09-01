import { ERROR_CATEGORY, type ErrorCategory } from '@/domain/constants/enums';

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(params: {
    category: ErrorCategory;
    code: string;
    message: string;
    userMessage: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.category = params.category;
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.retryable = params.retryable ?? false;
    this.cause = params.cause;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const toUserMessage = (error: unknown): string => {
  if (isAppError(error)) return error.userMessage;
  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu';
};

export const networkError = (cause?: unknown) =>
  new AppError({
    category: ERROR_CATEGORY.NETWORK,
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    userMessage: 'Bağlantı hatası. Lütfen tekrar dene.',
    retryable: true,
    cause,
  });

export const authError = (code: string, userMessage: string) =>
  new AppError({
    category: ERROR_CATEGORY.AUTHENTICATION,
    code,
    message: userMessage,
    userMessage,
    retryable: false,
  });

export const entitlementError = (userMessage: string) =>
  new AppError({
    category: ERROR_CATEGORY.ENTITLEMENT,
    code: 'ENTITLEMENT_DENIED',
    message: userMessage,
    userMessage,
    retryable: false,
  });

export const roomError = (code: string, userMessage: string) =>
  new AppError({
    category: ERROR_CATEGORY.ROOM,
    code,
    message: userMessage,
    userMessage,
    retryable: false,
  });

export const gameError = (code: string, userMessage: string, retryable = false) =>
  new AppError({
    category: ERROR_CATEGORY.GAME,
    code,
    message: userMessage,
    userMessage,
    retryable,
  });

export const validationError = (userMessage: string) =>
  new AppError({
    category: ERROR_CATEGORY.VALIDATION,
    code: 'VALIDATION_ERROR',
    message: userMessage,
    userMessage,
    retryable: false,
  });
