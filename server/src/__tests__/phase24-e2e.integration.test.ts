/**
 * Phase 24 — Real local stack integration tests (PostgreSQL + Redis + API).
 * Run: RUN_E2E=true npm test -- src/__tests__/phase24-e2e.integration.test.ts
 *
 * Prerequisites:
 *   docker compose up -d (in server/)
 *   npm run db:migrate && npm run db:seed && npm run db:import-content
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../database/prisma.js';
import { GAME_RULES, difficultyForRound } from '../games/game-rules.js';
import { grantPremium } from '../entitlements/entitlement.service.js';
import { resetRoundTimeouts } from '../games/game.service.js';

const RUN_E2E = process.env.RUN_E2E === 'true';

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function registerUser(app: FastifyInstance, label: string) {
  const username = `e2e_${label}_${Date.now().toString(36).slice(-6)}`;
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username,
      password: 'TestPass123!',
      birthDate: '2000-01-01',
    },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json() as { success: boolean; data: { tokens: { accessToken: string }; user: { id: string } } };
  return { token: body.data.tokens.accessToken, userId: body.data.user.id };
}

describe.skipIf(!RUN_E2E)('PHASE 24 — Local E2E integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma.$connect();
  });

  afterAll(async () => {
    resetRoundTimeouts();
    await app.close();
    await prisma.$disconnect();
  });

  it('content dataset: 6000 approved/active in DB', async () => {
    const total = await prisma.gameContent.count();
    expect(total).toBeGreaterThanOrEqual(6000);
    const approved = await prisma.gameContent.count({
      where: { active: true, moderationStatus: { in: ['APPROVED', 'ACTIVE'] } },
    });
    expect(approved).toBeGreaterThanOrEqual(6000);
    const categories = await prisma.category.count({ where: { isActive: true } });
    expect(categories).toBe(20);
    for (const cat of await prisma.category.findMany({ select: { id: true } })) {
      const count = await prisma.gameContent.count({
        where: { categoryId: cat.id, active: true, moderationStatus: { in: ['APPROVED', 'ACTIVE'] } },
      });
      expect(count).toBeGreaterThanOrEqual(300);
    }
  });

  it('premium host + free players — 5 player room and 30-round game', async () => {
    const host = await registerUser(app, 'host');
    const b = await registerUser(app, 'b');
    const c = await registerUser(app, 'c');
    const d = await registerUser(app, 'd');
    const e = await registerUser(app, 'e');

    await grantPremium({
      userId: host.userId,
      source: 'admin',
      expiresAt: new Date(Date.now() + 86400000 * 30),
      provider: 'admin',
      productId: 'com.nkt.app.premium.monthly',
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(host.token),
      payload: { hostDisplayName: 'Host A' },
    });
    expect(createRes.statusCode).toBe(200);
    const createBody = createRes.json() as { data: { room: { id: string; code: string }; player: { sessionToken: string } } };
    const roomId = createBody.data.room.id;
    const roomCode = createBody.data.room.code;
    const hostSession = createBody.data.player.sessionToken;
    const hostPlayerId = (createRes.json() as { data: { room: { players: { id: string }[] } } }).data.room.players?.[0]?.id;

    const joiners = [
      { ...b, name: 'B' },
      { ...c, name: 'C' },
      { ...d, name: 'D' },
      { ...e, name: 'E' },
    ];
    const sessions: Array<{ playerId: string; sessionToken: string; token: string }> = [
      { playerId: hostPlayerId!, sessionToken: hostSession, token: host.token },
    ];

    for (const j of joiners) {
      const joinRes = await app.inject({
        method: 'POST',
        url: '/api/v1/rooms/join',
        headers: authHeader(j.token),
        payload: { code: roomCode, displayName: j.name },
      });
      expect(joinRes.statusCode).toBe(200);
      const jb = joinRes.json() as { data: { player: { id: string; sessionToken: string } } };
      sessions.push({ playerId: jb.data.player.id, sessionToken: jb.data.player.sessionToken, token: j.token });
    }

    for (const s of sessions) {
      await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${roomId}/ready`,
        headers: authHeader(s.token),
        payload: { sessionToken: s.sessionToken, isReady: true },
      });
    }

    const premiumCat = await prisma.category.findFirst({ where: { isFree: false, isActive: true } });
    expect(premiumCat).toBeTruthy();

    const catRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/category`,
      headers: authHeader(host.token),
      payload: { sessionToken: hostSession, categoryId: premiumCat!.id },
    });
    expect(catRes.statusCode).toBe(200);

    const freeHost = await registerUser(app, 'freehost');
    const freeCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(freeHost.token),
      payload: { hostDisplayName: 'Free Host' },
    });
    const freeRoom = (freeCreate.json() as { data: { room: { id: string }; player: { sessionToken: string } } }).data;
    const denyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${freeRoom.room.id}/category`,
      headers: authHeader(freeHost.token),
      payload: { sessionToken: freeRoom.player.sessionToken, categoryId: premiumCat!.id },
    });
    expect(denyRes.statusCode).toBe(403);

    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/start`,
      headers: authHeader(host.token),
      payload: { sessionToken: hostSession },
    });
    expect(startRes.statusCode).toBe(200);
    const gameId = (startRes.json() as { data: { gameId: string } }).data.gameId;

    const usedContentIds = new Set<string>();
    const difficulties: number[] = [];

    for (let round = 0; round < GAME_RULES.TOTAL_QUESTIONS; round++) {
      const game = await prisma.game.findUniqueOrThrow({
        where: { id: gameId },
        include: {
          rounds: {
            where: { roundNum: round },
            include: { questions: true, matches: true, answers: true },
          },
        },
      });
      expect(game.currentStage).toBe(round);
      const currentRound = game.rounds[0]!;
      difficulties.push(difficultyForRound(round));
      const contentId = currentRound.questions[0]!.contentId;
      expect(usedContentIds.has(contentId)).toBe(false);
      usedContentIds.add(contentId);

      for (const match of currentRound.matches) {
        const content = await prisma.gameContent.findUnique({ where: { id: contentId } });
        const isAction = content?.type === 'CHALLENGE' || content?.type === 'PERFORMANCE';
        const answererId = isAction ? match.playerAId : match.playerBId;
        const session = sessions.find((s) => s.playerId === answererId)!;
        const answer = isAction ? 'completed' : (content?.correctAnswer ?? 'yes');
        const ansRes = await app.inject({
          method: 'POST',
          url: `/api/v1/games/${gameId}/answer`,
          headers: authHeader(session.token),
          payload: {
            playerId: session.playerId,
            sessionToken: session.sessionToken,
            roundId: currentRound.id,
            answer,
            clientScore: 999999,
          },
        });
        expect(ansRes.statusCode).toBe(200);
      }
    }

    expect(difficulties.slice(0, 10).every((d) => d === 1)).toBe(true);
    expect(difficulties.slice(10, 20).every((d) => d === 2)).toBe(true);
    expect(difficulties.slice(20, 30).every((d) => d === 3)).toBe(true);

    const resultRes = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${gameId}/result`,
      headers: authHeader(host.token),
    });
    expect(resultRes.statusCode).toBe(200);
    const result = (resultRes.json() as { data: { status: string; scores: unknown[] } }).data;
    expect(result.status).toBe('completed');
    expect(result.scores.length).toBe(5);
  }, 120_000);

  it('rejects fake score manipulation', async () => {
    const host = await registerUser(app, 'score');
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(host.token),
      payload: { hostDisplayName: 'Solo' },
    });
    const { room, player } = (createRes.json() as { data: { room: { id: string }; player: { id: string; sessionToken: string } } }).data;
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.id}/ready`,
      headers: authHeader(host.token),
      payload: { sessionToken: player.sessionToken, isReady: true },
    });
    const cat = await prisma.category.findFirst({ where: { isFree: true, isActive: true } });
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.id}/category`,
      headers: authHeader(host.token),
      payload: { sessionToken: player.sessionToken, categoryId: cat!.id },
    });
    const guest = await registerUser(app, 'guest2');
    await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/join',
      headers: authHeader(guest.token),
      payload: { code: (createRes.json() as { data: { room: { code: string } } }).data.room.code, displayName: 'G2' },
    });
    // Need min 2 players - get guest session and ready both
    const roomState = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
      include: { players: { where: { leftAt: null } } },
    });
    for (const p of roomState.players) {
      await prisma.roomPlayer.update({ where: { id: p.id }, data: { isReady: true } });
    }
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.id}/start`,
      headers: authHeader(host.token),
      payload: { sessionToken: player.sessionToken },
    });
    const gameId = (startRes.json() as { data: { gameId: string } }).data.gameId;
    const round = await prisma.gameRound.findFirst({ where: { gameId, roundNum: 0 }, include: { matches: true } });
    const match = round!.matches[0]!;
    const responder = match.playerBId;
    const gp = roomState.players.find((p) => p.id === responder)!;
    await app.inject({
      method: 'POST',
      url: `/api/v1/games/${gameId}/answer`,
      headers: authHeader(guest.token),
      payload: {
        playerId: gp.id,
        sessionToken: gp.sessionToken,
        roundId: round!.id,
        answer: 'wrong',
        clientScore: 999999,
      },
    });
    const score = await prisma.gameScore.findFirst({ where: { gameId, playerId: responder } });
    expect(score?.score ?? 0).toBeLessThan(999999);
  });
});
