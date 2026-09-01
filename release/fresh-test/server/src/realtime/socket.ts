import { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import { REALTIME_EVENTS, REALTIME_ERROR_CODES } from './events.js';
import { verifyAccessToken } from '../auth/auth.service.js';
import { logger } from '../common/logger.js';
import { config } from '../config/index.js';
import { prisma } from '../database/prisma.js';
import { isRedisAvailable } from '../common/redis.js';
import { checkSocketRateLimit } from './rate-limit.js';
import { publishFullRoomUpdate } from './publish.js';
import {
  clearDisconnectGrace,
  scheduleHostDisconnectGrace,
  schedulePlayerDisconnectGrace,
} from './disconnect-grace.js';
import { mapRoomToDto } from '../rooms/room.service.js';

export { REALTIME_EVENTS } from './events.js';

let io: Server | null = null;
let emitter: Emitter | null = null;

export function getIO(): Server | null {
  return io;
}

function socketError(socket: Socket, code: string, message: string) {
  socket.emit('error', { code, message });
}

function rateLimitOrFail(socket: Socket, event: string, max: number, windowMs: number): boolean {
  const userId = String(socket.data.userId ?? socket.id);
  const key = `${userId}:${event}`;
  if (checkSocketRateLimit(key, max, windowMs)) return true;
  socketError(socket, REALTIME_ERROR_CODES.RATE_LIMITED, 'Too many requests');
  return false;
}

async function setupRedisAdapter(server: Server): Promise<void> {
  if (!isRedisAvailable()) return;
  const pub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const sub = pub.duplicate();
  server.adapter(createAdapter(pub, sub));
  logger.info('Socket.IO Redis adapter enabled');
}

function setupRedisEmitter(): void {
  if (!isRedisAvailable()) return;
  const pub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  emitter = new Emitter(pub);
  logger.info('Socket.IO Redis emitter enabled for API mode');
}

function emitToRoom(room: string, event: string, payload: unknown) {
  if (io) {
    io.to(room).emit(event, payload);
  } else if (emitter) {
    emitter.to(room).emit(event, payload);
  }
}

export function publishRoomEvent(roomId: string, event: string, payload: unknown) {
  emitToRoom(`room:${roomId}`, event, payload);
}

export function publishGameEvent(gameId: string, event: string, payload: unknown) {
  emitToRoom(`game:${gameId}`, event, payload);
}

export function initRealtimeEmitter(): void {
  if (config.SERVICE_ROLE === 'api') {
    setupRedisEmitter();
  }
}

function registerSocketHandlers(server: Server) {
  server.use(async (socket, next) => {
    try {
      if (!rateLimitOrFail(socket, 'connect', 20, 60_000)) {
        return next(new Error('Rate limited'));
      }
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status === 'DELETED' || user.status === 'SUSPENDED') return next(new Error('Unauthorized'));
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  server.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id, userId: socket.data.userId }, 'Socket connected');

    socket.on('join:room', async (
      { roomId, sessionToken }: { roomId: string; sessionToken: string },
      ack?: (response: { ok?: boolean; error?: { code: string; message: string } }) => void,
    ) => {
      if (!rateLimitOrFail(socket, 'join:room', 30, 60_000)) {
        ack?.({ error: { code: REALTIME_ERROR_CODES.RATE_LIMITED, message: 'Rate limited' } });
        return;
      }
      const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
      if (!player || player.roomId !== roomId || player.leftAt) {
        const err = { code: REALTIME_ERROR_CODES.FORBIDDEN, message: 'Not a room member' };
        socket.emit('error', err);
        ack?.({ error: err });
        return;
      }
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.status === 'CLOSED') {
        const err = { code: REALTIME_ERROR_CODES.ROOM_CLOSED, message: 'Room closed' };
        socket.emit('error', err);
        ack?.({ error: err });
        return;
      }
      clearDisconnectGrace(roomId, player.id);
      socket.join(`room:${roomId}`);
      socket.data.roomId = roomId;
      socket.data.playerId = player.id;
      socket.data.sessionToken = sessionToken;
      socket.data.isHost = player.isHost;
      const fullRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
      });
      if (fullRoom) {
        const dto = mapRoomToDto(fullRoom);
        const playerDto = dto.players.find((p) => p.id === player.id);
        if (playerDto) {
          socket.to(`room:${roomId}`).emit(REALTIME_EVENTS.ROOM_JOINED, { room: dto, player: playerDto });
        }
      }
      ack?.({ ok: true });
      await publishFullRoomUpdate(roomId);
    });

    socket.on('leave:room', async ({ roomId }: { roomId: string }) => {
      if (!rateLimitOrFail(socket, 'leave:room', 20, 60_000)) return;
      socket.leave(`room:${roomId}`);
      if (socket.data.roomId === roomId) {
        socket.to(`room:${roomId}`).emit(REALTIME_EVENTS.ROOM_LEFT, {
          roomId,
          playerId: socket.data.playerId,
        });
        socket.data.roomId = undefined;
      }
    });

    socket.on('join:game', async (
      { gameId, playerId }: { gameId: string; playerId: string },
      ack?: (response: { ok?: boolean; error?: { code: string; message: string } }) => void,
    ) => {
      if (!rateLimitOrFail(socket, 'join:game', 20, 60_000)) {
        ack?.({ error: { code: REALTIME_ERROR_CODES.RATE_LIMITED, message: 'Rate limited' } });
        return;
      }
      const gp = await prisma.gamePlayer.findFirst({ where: { gameId, playerId } });
      if (!gp) {
        const err = { code: REALTIME_ERROR_CODES.FORBIDDEN, message: 'Not a game player' };
        socket.emit('error', err);
        ack?.({ error: err });
        return;
      }
      socket.join(`game:${gameId}`);
      socket.data.gameId = gameId;
      ack?.({ ok: true });
    });

    socket.on('player:ready', async ({ isReady }: { isReady: boolean }) => {
      if (!rateLimitOrFail(socket, 'player:ready', 40, 60_000)) return;
      if (!socket.data.roomId || !socket.data.sessionToken) return;
      const { setPlayerReady } = await import('../rooms/room.service.js');
      await setPlayerReady(socket.data.roomId, socket.data.sessionToken, isReady);
      publishRoomEvent(socket.data.roomId, REALTIME_EVENTS.PLAYER_READY, {
        roomId: socket.data.roomId,
        playerId: socket.data.playerId,
        isReady,
      });
      await publishFullRoomUpdate(socket.data.roomId);
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId as string | undefined;
      const playerId = socket.data.playerId as string | undefined;
      const sessionToken = socket.data.sessionToken as string | undefined;
      const isHost = socket.data.isHost as boolean | undefined;
      if (!roomId || !playerId || !sessionToken) return;

      socket.to(`room:${roomId}`).emit(REALTIME_EVENTS.ROOM_LEFT, { roomId, playerId });
      logger.info({ roomId, playerId, isHost }, 'Socket disconnected');

      if (isHost) scheduleHostDisconnectGrace(roomId, playerId, sessionToken);
      else schedulePlayerDisconnectGrace(roomId, playerId, sessionToken);
    });
  });
}

export async function setupRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  await setupRedisAdapter(io);
  registerSocketHandlers(io);
  logger.info('Realtime server initialized');
  return io;
}

export async function startRealtimeOnly(httpServer: HttpServer) {
  return setupRealtime(httpServer);
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });
  io = null;
  logger.info('Realtime server closed');
}
