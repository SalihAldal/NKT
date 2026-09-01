import { describe, it, expect } from 'vitest';
import { PremiumAccessPolicy } from '@/services/entitlement/room-entitlement.service';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import type { Entitlement } from '@/domain/models/user';
import {
  validateRoomCode,
  generateRoomCode,
  isRoomCodeCollision,
  parseSecureDeepLink,
} from '@/services/security/validation';
import { DifficultyResolver, DefaultContentSelector } from '@/services/content/content-selector';
import type { GameContent } from '@/domain/models/content';
import { ANSWER_TYPE, GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import { AUTH_PROVIDER } from '@/domain/constants/enums';

const premiumEntitlement = (userId: string): Entitlement => ({
  userId,
  status: ENTITLEMENT_STATUS.PREMIUM,
  source: 'iap',
  verifiedAt: new Date().toISOString(),
});

const freeEntitlement = (userId: string): Entitlement => ({
  userId,
  status: ENTITLEMENT_STATUS.FREE,
  source: 'unknown',
});

describe('PremiumAccessPolicy', () => {
  it('host premium → room premium', () => {
    expect(PremiumAccessPolicy.isRoomPremium(premiumEntitlement('u1'))).toBe(true);
  });

  it('host free → room free', () => {
    expect(PremiumAccessPolicy.isRoomPremium(freeEntitlement('u1'))).toBe(false);
  });

  it('unauthorized premium category rejected', () => {
    expect(() =>
      PremiumAccessPolicy.assertPremiumCategoryAccess('cat-ask-iliski', freeEntitlement('u1'), false),
    ).toThrow();
  });
});

describe('Room code validation', () => {
  it('invalid room code rejected', () => {
    expect(validateRoomCode('abc')).toBe(false);
    expect(validateRoomCode('12345!')).toBe(false);
  });

  it('valid room code accepted', () => {
    expect(validateRoomCode('ABC123')).toBe(true);
  });

  it('same room code cannot collide', () => {
    const codes = new Set<string>();
    const code = generateRoomCode();
    expect(isRoomCodeCollision(code, codes)).toBe(false);
    codes.add(code);
    expect(isRoomCodeCollision(code, codes)).toBe(true);
  });
});

describe('DifficultyResolver', () => {
  it('difficulty accepted only 1/2/3', () => {
    expect(DifficultyResolver.normalize(1)).toBe(1);
    expect(DifficultyResolver.normalize(2)).toBe(2);
    expect(DifficultyResolver.normalize(3)).toBe(3);
    expect(() => DifficultyResolver.normalize(4)).toThrow();
  });
});

describe('ContentSelector', () => {
  const selector = new DefaultContentSelector();
  const base = (id: string, prompt: string): GameContent => ({
    id,
    categoryId: 'cat-1',
    type: GAME_CONTENT_TYPE.QUESTION,
    difficulty: 1,
    prompt,
    answerType: ANSWER_TYPE.CHOICE,
    tags: [],
    ageRating: 'all',
    premium: false,
    active: true,
    usageCount: 0,
    completionCount: 0,
    skipCount: 0,
    timeoutCount: 0,
    reportCount: 0,
    averageResponseTimeMs: 0,
    moderationStatus: 'approved',
    qualityStatus: 'active',
    locale: 'tr',
    createdAt: '',
    updatedAt: '',
  });
  const pool: GameContent[] = [base('c1', 'Q1'), base('c2', 'Q2')];

  it('duplicate question prevention contract', () => {
    const result = selector.select({
      categoryId: 'cat-1',
      premiumUnlocked: true,
      count: 1,
      excludeIds: ['c1'],
    }, pool);
    expect(result.items.every((i) => i.id !== 'c1')).toBe(true);
  });
});

describe('Guest identity separation', () => {
  it('guest provider is distinct from email', () => {
    expect(AUTH_PROVIDER.GUEST).not.toBe(AUTH_PROVIDER.EMAIL);
  });
});

describe('Deep link validation', () => {
  it('invalid deep link rejected', () => {
    expect(parseSecureDeepLink('https://evil.com/steal')).toBeNull();
    expect(parseSecureDeepLink('nkt://room/ABC')).toBeNull();
  });

  it('valid quiz deep link accepted', () => {
    expect(parseSecureDeepLink('nkt://test/abc123')).toEqual({ type: 'quiz', id: 'abc123' });
  });

  it('valid room deep link accepted', () => {
    expect(parseSecureDeepLink('nkt://room/ABC123')).toEqual({ type: 'room', id: 'ABC123' });
  });
});
