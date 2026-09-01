import { ROOM_CODE_LENGTH } from '@/domain/constants/enums';
import { validationError } from '@/services/errors/app-error';

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const SHARE_CODE_PATTERN = /^[a-zA-Z0-9_-]{4,32}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const validateRoomCode = (code: string): boolean => ROOM_CODE_PATTERN.test(code.toUpperCase());

export const assertValidRoomCode = (code: string): void => {
  if (!validateRoomCode(code)) {
    throw validationError('Geçersiz oda kodu. 6 haneli kod gir.');
  }
};

export const validateShareCode = (code: string): boolean => SHARE_CODE_PATTERN.test(code);

export const validateUsername = (username: string): boolean => USERNAME_PATTERN.test(username);

export const sanitizeText = (input: string, maxLength = 500): string =>
  input.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);

export const parseSecureDeepLink = (
  url: string,
): { type: 'quiz' | 'room' | 'invite' | 'profile' | 'friend'; id: string } | null => {
  try {
    const parsed = new URL(url.replace(/^nkt:\/\//, 'https://placeholder/'));
    const path = parsed.pathname;

    const roomMatch = path.match(/^\/room\/([A-Z0-9]{6})$/i);
    if (roomMatch?.[1]) {
      const code = roomMatch[1].toUpperCase();
      if (validateRoomCode(code)) return { type: 'room', id: code };
      return null;
    }

    const testMatch = path.match(/^\/test\/([^/]+)$/);
    if (testMatch?.[1] && validateShareCode(testMatch[1])) {
      return { type: 'quiz', id: testMatch[1] };
    }

    const inviteMatch = path.match(/^\/invite\/([^/]+)$/);
    if (inviteMatch?.[1] && inviteMatch[1].length <= 64) {
      return { type: 'invite', id: inviteMatch[1] };
    }

    const profileMatch = path.match(/^\/profile\/([a-z0-9_]{3,30})$/);
    if (profileMatch?.[1] && validateUsername(profileMatch[1])) {
      return { type: 'profile', id: profileMatch[1] };
    }

    const friendMatch = path.match(/^\/friend\/([a-zA-Z0-9_-]{4,64})$/);
    if (friendMatch?.[1]) {
      return { type: 'friend', id: friendMatch[1] };
    }

    return null;
  } catch {
    return null;
  }
};

export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export const isRoomCodeCollision = (code: string, existingCodes: Set<string>): boolean =>
  existingCodes.has(code.toUpperCase());
