import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIXED_CATEGORIES,
  FREE_CATEGORY_IDS,
  PREMIUM_CATEGORY_IDS,
  PRODUCT_CATEGORY_COUNT,
  MIN_FREE_CATEGORIES,
  getCategoryById,
} from '@/domain/constants/categories';
import { MINIMUM_CONTENT_TARGET, CONTENT_QUALITY_STATUS } from '@/domain/constants/content';
import { ANSWER_TYPE, ENTITLEMENT_STATUS, GAME_CONTENT_TYPE, MODERATION_STATUS } from '@/domain/constants/enums';
import { GAME_CONFIG } from '@/domain/constants/game';
import type { GameContent } from '@/domain/models/content';
import { PremiumAccessPolicy, roomEntitlementService } from '@/services/entitlement/room-entitlement.service';
import type { Entitlement } from '@/domain/models/user';
import { contentRepository } from '@/services/content/content-repository';
import { DefaultContentSelector, DifficultyResolver } from '@/services/content/content-selector';
import { contentHistoryService } from '@/services/content/content-history';
import { checkDuplicate } from '@/services/content/content-normalizer';
import { stripSensitiveContent } from '@/services/content/content-presenter';
import { ageRestrictionService } from '@/services/content/age-restriction.service';
import { customCategoryService } from '@/services/content/custom-category.service';
import { createMockContentApi } from '@/api/mock/content.mock';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { roomServer, gameServerRef } from '@/api/mock/room.mock';

const selector = new DefaultContentSelector();
const contentApi = createMockContentApi();

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

const makeContent = (overrides: Partial<GameContent> & Pick<GameContent, 'id' | 'categoryId' | 'prompt'>): GameContent => ({
  type: GAME_CONTENT_TYPE.QUESTION,
  difficulty: 1,
  answerType: ANSWER_TYPE.CHOICE,
  tags: [],
  ageRating: 'all',
  premium: false,
  active: true,
  moderationStatus: MODERATION_STATUS.APPROVED,
  qualityStatus: CONTENT_QUALITY_STATUS.ACTIVE,
  locale: 'tr',
  usageCount: 0,
  completionCount: 0,
  skipCount: 0,
  timeoutCount: 0,
  reportCount: 0,
  averageResponseTimeMs: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  contentRepository._reset();
  contentHistoryService._reset();
  customCategoryService._reset();
});

describe('PHASE 04 — Content Engine', () => {
  it('1. 20 category seed başarılı', () => {
    expect(FIXED_CATEGORIES).toHaveLength(PRODUCT_CATEGORY_COUNT);
    expect(FIXED_CATEGORIES).toHaveLength(20);
  });

  it('2. category slug unique', () => {
    const slugs = FIXED_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('3. 5 free category doğru', () => {
    expect(FREE_CATEGORY_IDS).toHaveLength(MIN_FREE_CATEGORIES);
    expect(FREE_CATEGORY_IDS.every((id) => getCategoryById(id)?.isFree)).toBe(true);
  });

  it('4. 15 premium category doğru', () => {
    expect(PREMIUM_CATEGORY_IDS).toHaveLength(15);
    expect(PREMIUM_CATEGORY_IDS.every((id) => !getCategoryById(id)?.isFree)).toBe(true);
  });

  it('5. minimumContentTarget = 300', () => {
    expect(FIXED_CATEGORIES.every((c) => c.minimumContentTarget === MINIMUM_CONTENT_TARGET)).toBe(true);
  });

  it('6. content difficulty valid', () => {
    expect(DifficultyResolver.normalize(1)).toBe(1);
    expect(() => DifficultyResolver.normalize(0)).toThrow();
    expect(() => contentRepository.create({
      categoryId: 'cat-korku',
      prompt: 'Geçersiz zorluk',
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 9 as 1,
      answerType: ANSWER_TYPE.CHOICE,
    })).toThrow();
  });

  it('7. invalid content rejected', () => {
    const result = contentRepository.importJson([{ prompt: 'eksik alan' }]);
    expect(result.rejected).toBeGreaterThan(0);
    expect(result.imported).toBe(0);
  });

  it('8. duplicate content detected', () => {
    const pool = [makeContent({ id: 'd1', categoryId: 'cat-korku', prompt: 'Aynı soru?' })];
    const dup = checkDuplicate('aynı soru?', pool);
    expect(dup.isExactDuplicate).toBe(true);
    const existing = contentRepository.getByCategory('cat-korku')[0]!;
    expect(() => contentRepository.create({
      categoryId: 'cat-korku',
      prompt: existing.prompt,
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 1,
      answerType: ANSWER_TYPE.CHOICE,
    })).toThrow();
  });

  it('9. inactive content never selected', () => {
    const pool = [
      makeContent({ id: 'in1', categoryId: 'cat-korku', prompt: 'Pasif', active: false }),
      makeContent({ id: 'ac1', categoryId: 'cat-korku', prompt: 'Aktif' }),
    ];
    const result = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 5 }, pool);
    expect(result.items.every((i) => i.active)).toBe(true);
    expect(result.items.some((i) => i.id === 'in1')).toBe(false);
  });

  it('10. rejected content never selected', () => {
    const pool = [
      makeContent({
        id: 'rj1',
        categoryId: 'cat-korku',
        prompt: 'Reddedildi',
        moderationStatus: MODERATION_STATUS.REJECTED,
        qualityStatus: CONTENT_QUALITY_STATUS.REJECTED,
        active: false,
      }),
      makeContent({ id: 'ok1', categoryId: 'cat-korku', prompt: 'Onaylı' }),
    ];
    const result = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 3 }, pool);
    expect(result.items.every((i) => i.id !== 'rj1')).toBe(true);
  });

  it('11. premium content blocked in free room', () => {
    const pool = contentRepository.getByCategory('cat-ask-iliski', true);
    const result = selector.select({ categoryId: 'cat-ask-iliski', premiumUnlocked: false, count: 10 }, pool);
    expect(result.items.every((i) => !i.premium)).toBe(true);
    expect(() =>
      PremiumAccessPolicy.assertPremiumCategoryAccess('cat-ask-iliski', freeEntitlement('u1'), false),
    ).toThrow();
  });

  it('12. premium content allowed in premium host room', () => {
    const pool = contentRepository.getByCategory('cat-ask-iliski', true);
    const result = selector.select({ categoryId: 'cat-ask-iliski', premiumUnlocked: true, count: 5 }, pool);
    expect(result.items.length).toBeGreaterThan(0);
    expect(PremiumAccessPolicy.isRoomPremium(premiumEntitlement('host'))).toBe(true);
  });

  it('13. free players can play premium host room', async () => {
    await entitlementService.setEntitlement(premiumEntitlement('host'));
    const snapshot = roomEntitlementService.evaluateRoom('host', premiumEntitlement('host'), 'room-1');
    expect(snapshot.isPremiumRoom).toBe(true);
    expect(snapshot.premiumCategoryIds.length).toBeGreaterThan(0);
  });

  it('14. same game içinde duplicate yok', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const used = new Set<string>();
    for (let round = 1; round <= 10; round++) {
      const { items } = selector.select({
        categoryId: 'cat-korku',
        premiumUnlocked: true,
        count: 1,
        difficulty: DifficultyResolver.resolveForRound(round, 30),
        excludeIds: [...used],
        seed: 'game-1',
        roundNumber: round,
      }, pool);
      expect(items).toHaveLength(1);
      expect(used.has(items[0]!.id)).toBe(false);
      used.add(items[0]!.id);
    }
  });

  it('15. recent history avoidance çalışıyor', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const recentId = pool[0]!.id;
    const result = selector.select({
      categoryId: 'cat-korku',
      premiumUnlocked: true,
      count: 3,
      recentHistoryIds: [recentId],
    }, pool);
    expect(result.items.every((i) => i.id !== recentId)).toBe(true);
  });

  it('16. easy/medium/hard filters correct', () => {
    expect(DifficultyResolver.resolveForRound(5, 30)).toBe(1);
    expect(DifficultyResolver.resolveForRound(15, 30)).toBe(2);
    expect(DifficultyResolver.resolveForRound(25, 30)).toBe(3);
    const pool = contentRepository.getByCategory('cat-korku', true);
    const easy = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 5, difficulty: 1 }, pool);
    expect(easy.items.every((i) => i.difficulty === 1)).toBe(true);
  });

  it('17. 30 content plan oluşturulabiliyor', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const used = new Set<string>();
    const plans: string[] = [];
    for (let round = 1; round <= GAME_CONFIG.TOTAL_QUESTIONS; round++) {
      const { items } = selector.select({
        categoryId: 'cat-korku',
        premiumUnlocked: true,
        count: 1,
        difficulty: DifficultyResolver.resolveForRound(round, GAME_CONFIG.TOTAL_QUESTIONS),
        excludeIds: [...used],
        seed: `plan-${round}`,
        roundNumber: round,
      }, pool);
      plans.push(items[0]!.id);
      used.add(items[0]!.id);
    }
    expect(plans).toHaveLength(30);
    expect(new Set(plans).size).toBe(30);
  });

  it('18. hidden correct answer client\'a sızmıyor', () => {
    const raw = contentRepository.getByCategory('cat-korku', true)[0]!;
    const safe = stripSensitiveContent({ ...raw, correctAnswer: 'secret' });
    expect('correctAnswer' in safe && safe.correctAnswer !== undefined).toBe(false);
    expect(safe.options?.every((o) => !('isCorrect' in o))).toBe(true);
  });

  it('19. +18 content age restriction çalışıyor', () => {
    expect(ageRestrictionService.canAccessCategory('cat-18', { isGuest: true })).toBe(false);
    expect(ageRestrictionService.canAccessCategory('cat-18', { isGuest: false, birthYear: 2010 })).toBe(false);
    expect(ageRestrictionService.canAccessCategory('cat-18', { isGuest: false, birthYear: 1990 })).toBe(true);
    expect(getCategoryById('cat-18')?.ageRating).toBe('18+');
  });

  it('20. custom category private', async () => {
    await entitlementService.setEntitlement(premiumEntitlement('owner'));
    const cat = await customCategoryService.create('owner', 'Özel Oda', 'Sadece oda');
    expect(cat.visibility).toBe('room-only');
    expect(cat.ownerId).toBe('owner');
  });

  it('21. public custom category discovery yok', async () => {
    await entitlementService.setEntitlement(premiumEntitlement('owner'));
    await customCategoryService.create('owner', 'Gizli', 'Açıklama');
    expect(await customCategoryService.listPublic()).toHaveLength(0);
  });

  it('22. bulk import validation works', () => {
    const result = contentRepository.importJson([
      { categoryId: 'cat-korku', prompt: 'Import test sorusu bir', type: 'question', difficulty: 1, answerType: 'choice' },
      { categoryId: 'invalid', prompt: 'Bad category test' },
    ]);
    expect(result.imported).toBe(1);
    expect(result.rejected).toBe(1);
  });

  it('23. CSV import', () => {
    const csv = 'categoryId,prompt,type,difficulty,answerType\n' +
      'cat-korku,CSV import test sorusu,question,2,choice\n';
    const result = contentRepository.importCsv(csv);
    expect(result.imported).toBe(1);
  });

  it('24. JSON import', () => {
    const result = contentRepository.importJson([
      { categoryId: 'cat-gece', prompt: 'JSON import test sorusu', type: 'question', difficulty: 1, answerType: 'choice' },
    ]);
    expect(result.imported).toBe(1);
  });

  it('25. category content counts correct', () => {
    const stats = contentRepository.getCategoryStats();
    expect(stats).toHaveLength(20);
    stats.forEach((s) => {
      expect(s.contentCount).toBeGreaterThan(0);
      expect(s.warning).toBe(s.contentCount < s.minimumContentTarget);
    });
  });

  it('26. admin filters', () => {
    const { items, total } = contentRepository.filter({ categoryId: 'cat-korku', difficulty: 1, page: 1, pageSize: 10 });
    expect(total).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.every((i) => i.categoryId === 'cat-korku' && i.difficulty === 1)).toBe(true);
  });

  it('27. admin content CRUD', () => {
    const created = contentRepository.create({
      categoryId: 'cat-korku',
      prompt: 'CRUD test sorusu',
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 2,
      answerType: ANSWER_TYPE.CHOICE,
    });
    const updated = contentRepository.update(created.id, { difficulty: 3 });
    expect(updated.difficulty).toBe(3);
    const dup = contentRepository.duplicate(created.id);
    expect(dup.prompt).toContain('kopya');
    contentRepository.setActive(created.id, false);
    expect(contentRepository.getById(created.id)?.active).toBe(false);
    contentRepository.delete(dup.id);
  });

  it('28. analytics counters', () => {
    const item = contentRepository.getByCategory('cat-korku')[0]!;
    contentRepository.incrementUsage(item.id, 'completionCount');
    contentRepository.incrementUsage(item.id, 'reportCount');
    const updated = contentRepository.getById(item.id)!;
    expect(updated.completionCount).toBeGreaterThan(0);
    expect(updated.reportCount).toBeGreaterThan(0);
  });

  it('29. unauthorized content access rejected', async () => {
    const inactive = contentRepository.create({
      categoryId: 'cat-korku',
      prompt: 'Gizli içerik',
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 1,
      answerType: ANSWER_TYPE.CHOICE,
      active: false,
    });
    contentRepository.moderate(inactive.id, 'reject');
    await expect(contentApi.getById(inactive.id)).rejects.toThrow();
  });

  it('30. game engine integration', async () => {
    roomServer._reset();
    await entitlementService.setEntitlement({ userId: 'host', status: ENTITLEMENT_STATUS.FREE, source: 'unknown' });
    const { room, player: host } = await roomServer.create({ hostUserId: 'host', hostDisplayName: 'Host' });
    const j = await roomServer.join({ code: room.code, displayName: 'P2', userId: 'p2' });
    await roomServer.setReady({ roomId: room.id, playerId: host.id, sessionToken: host.sessionToken }, true);
    await roomServer.setReady({ roomId: room.id, playerId: j.player.id, sessionToken: j.player.sessionToken }, true);
    await roomServer.selectCategory(
      { roomId: room.id, playerId: host.id, sessionToken: host.sessionToken },
      'cat-korku',
    );
    const updated = await roomServer.startGame({ roomId: room.id, playerId: host.id, sessionToken: host.sessionToken });
    const gameId = updated.currentGameId!;
    const session = gameServerRef.getSession(gameId);
    expect(session?.roundPlans).toHaveLength(30);
    expect(session?.categoryId).toBe('cat-korku');
    const contentIds = session!.roundPlans.map((p) => p.contentId);
    expect(new Set(contentIds).size).toBe(30);
  });
});
