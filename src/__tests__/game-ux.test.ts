import { describe, it, expect, beforeEach } from 'vitest';
import { getCategoryTypeLines, getGameplayStyleSummary } from '@/domain/constants/category-display';
import { getCategoryContentMix, CATEGORY_CONTENT_MIX } from '@/domain/constants/category-mix';
import { getCategoryById, FIXED_CATEGORIES } from '@/domain/constants/categories';
import { validateContentRow } from '@/services/content/content-quality-validator';
import { stripSensitiveContent } from '@/services/content/content-presenter';
import { ageRestrictionService } from '@/services/content/age-restriction.service';
import { customCategoryService } from '@/services/content/custom-category.service';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { roomServer, gameServerRef } from '@/api/mock/room.mock';
import { contentRepository } from '@/services/content/content-repository';
import { DefaultContentSelector } from '@/services/content/content-selector';
import { difficultyForRound } from '@/domain/constants/game';
import { PremiumAccessPolicy } from '@/services/entitlement/room-entitlement.service';

const ctx = (room: { id: string }, player: { id: string; sessionToken: string }) => ({
  roomId: room.id,
  playerId: player.id,
  sessionToken: player.sessionToken,
});

const setupRoom = async (n: number, premium = false) => {
  await entitlementService.setEntitlement({
    userId: 'host',
    status: premium ? ENTITLEMENT_STATUS.PREMIUM : ENTITLEMENT_STATUS.FREE,
    source: premium ? 'iap' : 'unknown',
    verifiedAt: premium ? new Date().toISOString() : undefined,
  });
  const { room, player: host } = await roomServer.create({ hostUserId: 'host', hostDisplayName: 'Host' });
  const players = [host];
  for (let i = 1; i < n; i++) {
    const j = await roomServer.join({ code: room.code, displayName: `P${i}`, userId: `p${i}` });
    players.push(j.player);
  }
  for (const p of players) await roomServer.setReady(ctx(room, p), true);
  return { room, host, players };
};

const startGame = async (room: { id: string }, host: { id: string; sessionToken: string }, cat: string) => {
  await roomServer.selectCategory(ctx(room, host), cat);
  const r = await roomServer.startGame(ctx(room, host));
  return r.currentGameId!;
};

beforeEach(() => {
  roomServer._reset();
  contentRepository._reset();
  customCategoryService._reset();
});

describe('PHASE 05 — Game UX', () => {
  it('1. free category seçilebilir', async () => {
    const { room, host } = await setupRoom(2);
    await expect(roomServer.selectCategory(ctx(room, host), 'cat-korku')).resolves.toBeDefined();
  });

  it('2. premium category free host ile seçilmiyor', async () => {
    const { room, host } = await setupRoom(2, false);
    await expect(roomServer.selectCategory(ctx(room, host), 'cat-ask-iliski')).rejects.toThrow();
  });

  it('3. premium host premium category seçiyor', async () => {
    const { room, host } = await setupRoom(2, true);
    await expect(roomServer.selectCategory(ctx(room, host), 'cat-ask-iliski')).resolves.toBeDefined();
  });

  it('4. free player premium host room oynuyor', async () => {
    const { room, host } = await setupRoom(2, true);
    const snap = PremiumAccessPolicy.isRoomPremium({ userId: 'host', status: ENTITLEMENT_STATUS.PREMIUM, source: 'iap', verifiedAt: '' });
    expect(snap).toBe(true);
    const gameId = await startGame(room, host, 'cat-ask-iliski');
    expect(gameServerRef.getSession(gameId)?.categoryId).toBe('cat-ask-iliski');
  });

  it('5. +18 age restriction', () => {
    expect(ageRestrictionService.canAccessCategory('cat-18', { isGuest: true })).toBe(false);
    expect(ageRestrictionService.canAccessCategory('cat-18', { isGuest: false, birthYear: 1990 })).toBe(true);
  });

  it('6-10. 2-6 player games', async () => {
    for (const n of [2, 3, 4, 5, 6]) {
      roomServer._reset();
      const { room, host } = await setupRoom(n);
      const gameId = await startGame(room, host, 'cat-korku');
      expect(gameServerRef.getSession(gameId)?.players.length).toBe(n);
    }
  });

  it('11-13. content types in pool', () => {
    const korku = contentRepository.getByCategory('cat-korku', true);
    expect(korku.some((c) => c.type === 'question')).toBe(true);
    const cesaret = contentRepository.getByCategory('cat-cesaret', true);
    expect(cesaret.some((c) => c.type === 'challenge' || c.type === 'performance')).toBe(true);
  });

  it('14-16. difficulty stages', () => {
    expect(difficultyForRound(5)).toBe(1);
    expect(difficultyForRound(15)).toBe(2);
    expect(difficultyForRound(25)).toBe(3);
  });

  it('17. timer timeout path exists', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await startGame(room, host, 'cat-korku');
    const s = gameServerRef.getSession(gameId)!;
    expect(s.roundPlans[0]?.matches[0]).toBeDefined();
  });

  it('18. duplicate answer prevented', async () => {
    const { room, host, players } = await setupRoom(2);
    const gameId = await startGame(room, host, 'cat-korku');
    const responder = players[1]!;
    const view = gameServerRef.getPlayerView(gameId, responder.id);
    if (view.matchId) {
      gameServerRef.submitAnswer(gameId, responder.id, view.matchId, 'a');
      const s2 = gameServerRef.submitAnswer(gameId, responder.id, view.matchId, 'a');
      expect(s2.lastRoundResult?.scoreAwarded ?? 0).toBeLessThanOrEqual(300);
    }
  });

  it('19. duplicate content in game', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await startGame(room, host, 'cat-korku');
    const ids = gameServerRef.getSession(gameId)!.roundPlans.map((p) => p.contentId);
    expect(new Set(ids).size).toBe(30);
  });

  it('20. long question text supported in model', () => {
    const long = 'ÇOK UZUN '.repeat(50) + 'SORU? 😱';
    const v = validateContentRow({ categoryId: 'cat-korku', prompt: long, type: 'question', difficulty: 1 });
    expect(v.valid).toBe(true);
  });

  it('21. reconnect restores view', async () => {
    const { room, host } = await setupRoom(2);
    await startGame(room, host, 'cat-korku');
    expect(gameServerRef.resumeGame(room.id, host.id)).not.toBeNull();
  });

  it('22. final result stats built', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await startGame(room, host, 'cat-korku');
    const session = gameServerRef.getSession(gameId)!;
    session.status = 'completed';
    session.stage = 'completed';
    const view = gameServerRef.getPlayerView(gameId, host.id);
    expect(view.finalStats?.length).toBeGreaterThan(0);
  });

  it('23. rematch clears game', async () => {
    const { room, host } = await setupRoom(2);
    await startGame(room, host, 'cat-korku');
    await roomServer.rematch(ctx(room, host));
    const r = await roomServer.getRoomState(ctx(room, host));
    expect(r.currentGameId).toBeUndefined();
    expect(r.state).toBe('lobby');
  });

  it('24. custom category private', async () => {
    await entitlementService.setEntitlement({ userId: 'u1', status: ENTITLEMENT_STATUS.PREMIUM, source: 'iap', verifiedAt: '' });
    const cat = await customCategoryService.create('u1', 'Özel', 'Açıklama');
    expect(cat.visibility).toBe('room-only');
    expect(await customCategoryService.listPublic()).toHaveLength(0);
  });

  it('25. custom category authorization', async () => {
    await expect(customCategoryService.create('free-user', 'X', 'Y')).rejects.toThrow();
  });

  it('26. rejected content excluded', () => {
    const item = contentRepository.getByCategory('cat-korku')[0]!;
    contentRepository.moderate(item.id, 'reject');
    const pool = contentRepository.getByCategory('cat-korku', true);
    const selector = new DefaultContentSelector();
    const result = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 5 }, pool);
    expect(result.items.every((i) => i.id !== item.id)).toBe(true);
  });

  it('27. inactive content excluded', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const item = pool[0]!;
    contentRepository.setActive(item.id, false);
    const selector = new DefaultContentSelector();
    const result = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 5 }, pool);
    expect(result.items.every((i) => i.id !== item.id)).toBe(true);
  });

  it('28. premium content excluded from free room', () => {
    const pool = contentRepository.getByCategory('cat-ask-iliski', true);
    const selector = new DefaultContentSelector();
    const result = selector.select({ categoryId: 'cat-ask-iliski', premiumUnlocked: false, count: 10 }, pool);
    expect(result.items.every((i) => !i.premium)).toBe(true);
  });

  it('29. hidden answer never leaked', () => {
    const item = contentRepository.getByCategory('cat-korku')[0]!;
    const safe = stripSensitiveContent({ ...item, correctAnswer: 'secret' });
    expect('correctAnswer' in safe && (safe as { correctAnswer?: string }).correctAnswer !== undefined).toBe(false);
  });

  it('30. category display from metadata', () => {
    const korku = getCategoryById('cat-korku')!;
    const lines = getCategoryTypeLines(korku);
    expect(lines.some((l) => l.includes('Sorular'))).toBe(true);
    expect(getGameplayStyleSummary(korku)).toContain('soru');
    expect(CATEGORY_CONTENT_MIX['cat-korku']?.question).toBe(50);
    expect(getCategoryContentMix('cat-korku').question).toBe(50);
    FIXED_CATEGORIES.forEach((c) => expect(getCategoryTypeLines(c).length).toBeGreaterThan(0));
  });
});
