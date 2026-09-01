import { createHash, randomBytes } from 'crypto';
import { AppError } from '../common/response.js';

const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const PASSWORD_MIN = 8;
const RECOVERY_SEGMENT = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BANNED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'nkt',
  'moderator',
  'owner',
]);

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): string {
  const normalized = normalizeUsername(input);
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    throw new AppError('VALIDATION_ERROR', `Username must be ${USERNAME_MIN}-${USERNAME_MAX} chars`, 422);
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new AppError('VALIDATION_ERROR', 'Username can include only a-z, 0-9 and _', 422);
  }
  if (BANNED_USERNAMES.has(normalized)) {
    throw new AppError('USERNAME_NOT_ALLOWED', 'This username is not allowed', 422);
  }
  return normalized;
}

export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN) {
    throw new AppError('VALIDATION_ERROR', `Password must be at least ${PASSWORD_MIN} chars`, 422);
  }
}

export function parseBirthDate(input: string): Date {
  const trimmed = input.trim();
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid birthDate format. Use YYYY-MM-DD.', 422);
  }
  const [y, m, d] = digitsOnly(trimmed).match(/^(\d{4})(\d{2})(\d{2})$/)?.slice(1) ?? [];
  if (!y || !m || !d) {
    throw new AppError('VALIDATION_ERROR', 'Invalid birthDate format. Use YYYY-MM-DD.', 422);
  }
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() + 1 !== Number(m) ||
    date.getUTCDate() !== Number(d)
  ) {
    throw new AppError('VALIDATION_ERROR', 'Invalid birthDate value', 422);
  }
  if (date > new Date()) {
    throw new AppError('VALIDATION_ERROR', 'birthDate cannot be in future', 422);
  }
  return date;
}

export function calculateAgeYears(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isAdult18(birthDate: Date, now: Date = new Date()): boolean {
  return calculateAgeYears(birthDate, now) >= 18;
}

function randomCodePart(size: number): string {
  const bytes = randomBytes(size);
  let result = '';
  for (let i = 0; i < size; i++) {
    result += RECOVERY_SEGMENT[bytes[i]! % RECOVERY_SEGMENT.length];
  }
  return result;
}

export function generateRecoveryCode(): string {
  return `NKT-${randomCodePart(4)}-${randomCodePart(4)}-${randomCodePart(4)}`;
}

export function hashRecoveryCode(rawCode: string): string {
  return createHash('sha256')
    .update(rawCode.trim().toUpperCase())
    .digest('hex');
}
