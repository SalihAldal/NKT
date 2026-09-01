import { AppError } from '../common/response.js';

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const MAX_LENGTH = 20;

export function sanitizeDisplayName(raw: string): string {
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, MAX_LENGTH);
}

export function assertValidDisplayName(raw: string): string {
  const name = sanitizeDisplayName(raw);
  if (!name || name.length < 1) {
    throw new AppError('VALIDATION_ERROR', 'Display name is required', 422);
  }
  if (name.length > MAX_LENGTH) {
    throw new AppError('VALIDATION_ERROR', 'Display name too long', 422);
  }
  return name;
}
