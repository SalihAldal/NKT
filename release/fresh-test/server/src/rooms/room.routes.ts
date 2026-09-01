import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId, AppError } from '../common/response.js';
import * as roomService from '../rooms/room.service.js';
import * as gameService from '../games/game.service.js';
import { verifyGamePlayer, verifyGameAccess } from '../games/game-auth.js';
import { isHostPremium } from '../entitlements/entitlement.service.js';
import { prisma } from '../database/prisma.js';
import {
  publishFullRoomUpdate,
  publishGameStarted,
  publishRoomJoined,
  publishRoomClosed,
  publishHostChanged,
  publishRoundStarted,
} from '../realtime/publish.js';
import { REALTIME_EVENTS } from '../realtime/events.js';
import { publishRoomEvent } from '../realtime/socket.js';
import { assertJoinAllowed, recordFailedJoin, clearJoinFailures } from '../rooms/join-guard.js';
import { assertValidDisplayName } from '../rooms/display-name.js';

export async function roomRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.post('/create', async (req, reply) => {
    const body = z.object({
      hostDisplayName: z.string().min(1),
      hostAvatarEmoji: z.string().optional(),
      maxPlayers: z.number().optional(),
    }).parse(req.body);
    void body.maxPlayers;

    const isPremiumHost = await isHostPremium(req.userId!);

    const { room, player } = await roomService.createRoom({
      hostUserId: req.userId!,
      hostDisplayName: body.hostDisplayName,
      hostAvatarEmoji: body.hostAvatarEmoji,
      isPremiumHost: Boolean(isPremiumHost),
    });
    const full = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
      include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
    });
    const dto = await roomService.mapRoomToDtoWithKicked(full);
    publishRoomEvent(room.id, REALTIME_EVENTS.ROOM_CREATED, { room: dto });
    return ok({ room: dto, player: { id: player.id, sessionToken: player.sessionToken } }, getRequestId(req));
  });

  app.post('/join', async (req, reply) => {
    const ip = req.ip;
    const body = z.object({
      code: z.string().min(4).max(8),
      displayName: z.string().min(1),
      avatarEmoji: z.string().optional(),
    }).parse(req.body);

    try {
      assertJoinAllowed(ip, req.userId);
      assertValidDisplayName(body.displayName);
      const { room, player } = await roomService.joinRoom({
        code: body.code,
        displayName: body.displayName,
        userId: req.userId,
        avatarEmoji: body.avatarEmoji,
      });
      clearJoinFailures(ip, req.userId);
      const full = await prisma.room.findUniqueOrThrow({
        where: { id: room.id },
        include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
      });
      await publishRoomJoined(room.id, player.id);
      const dto = await roomService.mapRoomToDtoWithKicked(full);
      return ok({ room: dto, player: { id: player.id, sessionToken: player.sessionToken } }, getRequestId(req));
    } catch (e) {
      if (e instanceof AppError && e.code === 'ROOM_NOT_FOUND') {
        recordFailedJoin(ip, req.userId);
      }
      if (e instanceof Error && e.message === 'JOIN_RATE_LIMITED') {
        return reply.status(429).send(fail('RATE_LIMIT', 'Too many failed join attempts', undefined, getRequestId(req)));
      }
      throw e;
    }
  });

  app.post('/validate-code', async (req, reply) => {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const result = await roomService.validateRoomCode(code);
    return ok(result, getRequestId(req));
  });

  app.get('/:roomId', async (req, reply) => {
    const { sessionToken } = req.query as { sessionToken: string };
    if (!sessionToken) return reply.status(422).send(fail('VALIDATION_ERROR', 'sessionToken required', undefined, getRequestId(req)));
    const { roomId } = req.params as { roomId: string };
    const room = await roomService.getRoomByPlayerSession(roomId, sessionToken);
    return ok(await roomService.mapRoomToDtoWithKicked(room), getRequestId(req));
  });

  app.post('/:roomId/ready', async (req, reply) => {
    const { sessionToken, isReady } = z.object({ sessionToken: z.string(), isReady: z.boolean() }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    const room = await roomService.setPlayerReady(roomId, sessionToken, isReady);
    const player = room.players.find((p) => p.sessionToken === sessionToken);
    publishRoomEvent(roomId, REALTIME_EVENTS.PLAYER_READY, {
      roomId,
      playerId: player?.id ?? '',
      isReady,
    });
    await publishFullRoomUpdate(roomId);
    return ok(await roomService.mapRoomToDtoWithKicked(room), getRequestId(req));
  });

  app.post('/:roomId/leave', async (req, reply) => {
    const { sessionToken } = z.object({ sessionToken: z.string() }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
    const result = await roomService.leaveRoom(roomId, sessionToken);
    if (player) {
      publishRoomEvent(roomId, REALTIME_EVENTS.ROOM_LEFT, { roomId, playerId: player.id });
    }
    if (result.newHostId) await publishHostChanged(roomId, result.newHostId);
    if ((result.room as { status?: string }).status === 'CLOSED') await publishRoomClosed(roomId, 'empty');
    else await publishFullRoomUpdate(roomId);
    return ok(await roomService.mapRoomToDtoWithKicked(result.room as Awaited<ReturnType<typeof roomService.getRoomByPlayerSession>>), getRequestId(req));
  });

  app.post('/:roomId/kick', async (req, reply) => {
    const { sessionToken, targetPlayerId } = z.object({
      sessionToken: z.string(),
      targetPlayerId: z.string().uuid(),
    }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    const room = await roomService.kickPlayer(roomId, sessionToken, targetPlayerId);
    publishRoomEvent(roomId, REALTIME_EVENTS.ROOM_LEFT, { roomId, playerId: targetPlayerId });
    await publishFullRoomUpdate(roomId);
    return ok(await roomService.mapRoomToDtoWithKicked(room), getRequestId(req));
  });

  app.post('/:roomId/rematch', async (req, reply) => {
    const { sessionToken } = z.object({ sessionToken: z.string() }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    const room = await roomService.rematchRoom(roomId, sessionToken);
    await publishFullRoomUpdate(roomId);
    return ok(await roomService.mapRoomToDtoWithKicked(room), getRequestId(req));
  });

  app.post('/:roomId/close', async (req, reply) => {
    const { roomId } = req.params as { roomId: string };
    await roomService.closeRoom(roomId, req.userId!);
    await publishRoomClosed(roomId, 'host_closed');
    return ok({ closed: true }, getRequestId(req));
  });

  app.post('/:roomId/category', async (req, reply) => {
    const { sessionToken, categoryId } = z.object({ sessionToken: z.string(), categoryId: z.string() }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    await roomService.selectCategory(roomId, sessionToken, categoryId);
    publishRoomEvent(roomId, REALTIME_EVENTS.CATEGORY_SELECTED, { roomId, categoryId });
    const room = await roomService.getRoomByPlayerSession(roomId, sessionToken);
    await publishFullRoomUpdate(roomId);
    return ok(await roomService.mapRoomToDtoWithKicked(room), getRequestId(req));
  });

  app.post('/:roomId/start', async (req, reply) => {
    const { sessionToken } = z.object({ sessionToken: z.string() }).parse(req.body);
    const { roomId } = req.params as { roomId: string };
    const result = await roomService.startGame(roomId, sessionToken);
    await publishGameStarted(roomId, result.gameId);
    const firstRound = await prisma.gameRound.findFirst({
      where: { gameId: result.gameId, roundNum: 0 },
      include: { questions: true },
    });
    if (firstRound?.questions[0]) {
      await publishRoundStarted(roomId, result.gameId, 0, firstRound.questions[0].contentId);
    }
    return ok({ room: await roomService.mapRoomToDtoWithKicked(result.room), gameId: result.gameId }, getRequestId(req));
  });
}

export async function gameRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/room/:roomId/resume', async (req, reply) => {
    const query = z.object({ playerId: z.string().uuid(), sessionToken: z.string().min(16) }).parse(req.query);
    const { roomId } = req.params as { roomId: string };
    const player = await prisma.roomPlayer.findUnique({ where: { sessionToken: query.sessionToken } });
    if (!player || player.roomId !== roomId || player.id !== query.playerId) {
      return reply.status(403).send(fail('FORBIDDEN', 'Not a room member', undefined, getRequestId(req)));
    }
    const view = await gameService.resumeGameForPlayer(roomId, query.playerId);
    return ok(view, getRequestId(req));
  });

  app.get('/:gameId/view', async (req, reply) => {
    const query = z.object({ playerId: z.string().uuid(), sessionToken: z.string().min(16) }).parse(req.query);
    const { gameId } = req.params as { gameId: string };
    await verifyGamePlayer(gameId, query.playerId, query.sessionToken);
    const view = await gameService.getPlayerView(gameId, query.playerId);
    return ok(view, getRequestId(req));
  });

  app.post('/:gameId/answer', async (req, reply) => {
    const body = z.object({
      playerId: z.string().uuid(),
      sessionToken: z.string().min(16),
      roundId: z.string().uuid(),
      answer: z.string().max(500),
      clientScore: z.number().optional(),
    }).parse(req.body);
    void body.clientScore;
    const { gameId } = req.params as { gameId: string };
    await verifyGamePlayer(gameId, body.playerId, body.sessionToken);
    const view = await gameService.submitAnswer(gameId, body.playerId, body.roundId, body.answer);
    return ok(view, getRequestId(req));
  });

  app.get('/:gameId/result', async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    await verifyGameAccess(gameId, req.userId!);
    const result = await gameService.getGameResult(gameId);
    return ok(result, getRequestId(req));
  });
}
