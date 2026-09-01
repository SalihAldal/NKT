import { validateUsername } from '@/services/security/validation';

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;
const RESERVED_USERNAMES = ['admin', 'nkt', 'support', 'moderator'];

export interface EditProfileInput {
  name?: string;
  username?: string;
  bio?: string;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateProfileInput(input: EditProfileInput): ProfileValidationResult {
  const errors: Record<string, string> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) errors.name = 'Görünen ad boş olamaz.';
    if (trimmed.length > MAX_DISPLAY_NAME) errors.name = `En fazla ${MAX_DISPLAY_NAME} karakter.`;
  }
  if (input.username !== undefined) {
    const trimmed = input.username.trim().toLowerCase();
    if (!validateUsername(trimmed)) errors.username = 'Geçersiz kullanıcı adı (3-30 karakter, harf/rakam/_).';
    if (RESERVED_USERNAMES.includes(trimmed)) errors.username = 'Bu kullanıcı adı kullanılamaz.';
  }
  if (input.bio !== undefined && input.bio.length > MAX_BIO) {
    errors.bio = `En fazla ${MAX_BIO} karakter.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
