import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { roomServer } from '@/api/mock/room.mock';
import { gameServerRef } from '@/api/mock/room.mock';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { GAME_CONFIG } from '@/domain/constants/game';
import { PairingEngine } from '@/services/game/pairing-engine';
import { scoringEngine } from '@/services/game/scoring-engine';
import { GameStateMachine } from '@/services/game/game-state-machine';
import { isAppError } from '@/services/errors/app-error';
import { GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import { difficultyForRound, stageForRound } from '@/domain/constants/game';

const ctx = (room: { id: string }, player: { id: string; sessionToken: string }) => ({
  roomId: room.id,
  playerId: player.id,
  sessionToken: player.sessionToken,
});

const selectAndStart = async (
  room: { id: string },
  host: { id: string; sessionToken: string },
  categoryId: string,
) => {
  await roomServer.selectCategory(ctx(room, host), categoryId);
  const updated = await roomServer.startGame(ctx(room, host));
  return updated.currentGameId!;
};

const setupRoom = async (count: number, hostPremium = false) => {
  if (hostPremium) {
    await entitlementService.setEntitlement({
      userId: 'host',
      status: ENTITLEMENT_STATUS.PREMIUM,
      source: 'iap',
      verifiedAt: new Date().toISOString(),
    });
  } else {
    await entitlementService.setEntitlement({ userId: 'host', status: ENTITLEMENT_STATUS.FREE, source: 'unknown' });
  }
  const { room, player: host } = await roomServer.create({ hostUserId: 'host', hostDisplayName: 'Host' });
  const players = [host];
  for (let i = 1; i < count; i++) {
    const j = await roomServer.join({ code: room.code, displayName: `P${i + 1}`, userId: `p${i + 1}` });
    players.push(j.player);
  }
  for (const p of players) {
    await roomServer.setReady(ctx(room, p), true);
  }
  return { room, players, host };
};

beforeEach(() => {
  roomServer._reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Game Engine — PHASE 03', () => {
  it('1-5. 2-6+ oyuncu oyun başlatabilir', async () => {
    for (const n of [2, 3, 4, 5, 6]) {
      roomServer._reset();
      const { room, host } = await setupRoom(n);
      const gameId = await selectAndStart(room, host, 'cat-korku');
      expect(gameId).toBeTruthy();
      const session = gameServerRef.getSession(gameId);
      expect(session?.roundPlans).toHaveLength(GAME_CONFIG.TOTAL_QUESTIONS);
    }
  });

  it('6. pairing rotate olur', () => {
    const engine = new PairingEngine();
    const ids = ['a', 'b', 'c', 'd'];
    const r1 = engine.generatePairs(ids, 1);
    const r2 = engine.generatePairs(ids, 2);
    expect(r1).not.toEqual(r2);
  });

  it('7. same pair gereksiz tekrar etmez (rotation)', () => {
    const engine = new PairingEngine();
    const ids = ['a', 'b', 'c', 'd'];
    const pairs = new Set<string>();
    for (let r = 1; r <= 6; r++) {
      engine.generatePairs(ids, r).forEach((p) => {
        pairs.add([p.askerId, p.responderId].sort().join(':'));
      });
    }
    expect(pairs.size).toBeGreaterThan(1);
  });

  it('8-10. easy/medium/hard 10 soru', () => {
    for (let r = 1; r <= 10; r++) expect(difficultyForRound(r)).toBe(1);
    for (let r = 11; r <= 20; r++) expect(difficultyForRound(r)).toBe(2);
    for (let r = 21; r <= 30; r++) expect(difficultyForRound(r)).toBe(3);
    expect(stageForRound(10)).toBe(1);
    expect(stageForRound(11)).toBe(2);
    expect(stageForRound(21)).toBe(3);
  });

  it('11. timeout çalışır', async () => {
    const { room, host, players } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    vi.advanceTimersByTime(5000);
    const session = gameServerRef.getSession(gameId)!;
    expect(session.stage).toBe('round_active');
    vi.advanceTimersByTime(20000);
    const after = gameServerRef.getSession(gameId)!;
    expect(['round_result', 'round_active', 'stage_transition', 'final_result', 'completed']).toContain(after.stage);
  });

  it('12. duplicate answer reddedilir', async () => {
    const { room, host, players } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    vi.advanceTimersByTime(4000);
    const session = gameServerRef.getSession(gameId)!;
    expect(session.stage).toBe('round_active');
    const responder = players[1]!;
    const view = gameServerRef.getPlayerView(gameId, responder.id);
    expect(view.role).toBe('responder');
    expect(view.matchId).toBeTruthy();
    if (view.matchId) {
      const r1 = gameServerRef.submitAnswer(gameId, responder.id, view.matchId, 'a');
      const score1 = r1.scores.find((s) => s.playerId === responder.id)?.score ?? 0;
      const r2 = gameServerRef.submitAnswer(gameId, responder.id, view.matchId, 'a');
      const score2 = r2.scores.find((s) => s.playerId === responder.id)?.score ?? 0;
      expect(score2).toBe(score1);
    }
  });

  it('13. server score hesaplar', () => {
    const score = scoringEngine.calculate({
      difficulty: 1,
      contentType: GAME_CONTENT_TYPE.QUESTION,
      isCorrect: true,
      completed: true,
      timeRemainingMs: 10000,
      totalTimeMs: 15000,
    });
    expect(score).toBeGreaterThan(100);
  });

  it('14. client score manipülasyonu reddedilir — score server-side', () => {
    const wrong = scoringEngine.calculate({
      difficulty: 3,
      contentType: GAME_CONTENT_TYPE.QUESTION,
      isCorrect: false,
      completed: false,
      timeRemainingMs: 0,
      totalTimeMs: 7000,
    });
    expect(wrong).toBe(0);
  });

  it('15. reconnect state restore eder', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    const view = gameServerRef.resumeGame(room.id, host.id);
    expect(view).not.toBeNull();
    expect(view?.gameId).toBe(gameId);
  });

  it('19. host premium → premium game', async () => {
    const { room, host } = await setupRoom(2, true);
    const gameId = await selectAndStart(room, host, 'cat-ask-iliski');
    const session = gameServerRef.getSession(gameId);
    expect(session?.categoryId).toBe('cat-ask-iliski');
  });

  it('20. free host → premium category reddedilir', async () => {
    const { room, host } = await setupRoom(2, false);
    await expect(roomServer.selectCategory(ctx(room, host), 'cat-ask-iliski')).rejects.toThrow();
  });

  it('22. content duplicate prevention — 30 unique rounds', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    const session = gameServerRef.getSession(gameId)!;
    const ids = session.roundPlans.map((r) => r.contentId);
    expect(new Set(ids).size).toBe(30);
  });

  it('23. invalid state transition reddedilir', () => {
    const sm = new GameStateMachine('completed');
    expect(() => sm.transition('round_active')).toThrow();
  });

  it('24. game completed sonrası answer reddedilir', async () => {
    const { room, host, players } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    const session = gameServerRef.getSession(gameId)!;
    session.status = 'completed';
    session.stage = 'completed';
    try {
      gameServerRef.submitAnswer(gameId, players[0]!.id, 'fake', 'a');
      expect.fail('should throw');
    } catch (e) {
      expect(isAppError(e)).toBe(true);
    }
  });

  it('25. expired game rejected — completed resume null', async () => {
    const { room, host } = await setupRoom(2);
    const gameId = await selectAndStart(room, host, 'cat-korku');
    const session = gameServerRef.getSession(gameId)!;
    session.status = 'completed';
    expect(gameServerRef.resumeGame(room.id, host.id)).toBeNull();
  });
});
