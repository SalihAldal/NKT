import { randomBytes } from 'crypto';
import { prisma } from '../database/prisma.js';
import { AppError, ERR } from '../common/response.js';
import type { Room, RoomPlayer, RoomStatus, Prisma } from '@prisma/client';
import { GAME_RULES } from '../games/game-rules.js';
import { selectContentForGame, initializeGameRounds } from '../games/game.service.js';
import { assertValidDisplayName } from './display-name.js';
import { isHostPremium } from '../entitlements/entitlement.service.js';
import { assertRoomPlayersCanAccess18, assertUserCanAccess18 } from '../users/age-guard.js';
import { normalizeAvatarId, randomAvatarId } from './avatar-icons.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

const ROOM_STATUS_MAP: Record<RoomStatus, string> = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  COMPLETED: 'completed',
  CLOSED: 'cancelled',
  EXPIRED: 'cancelled',
};

function generateRoomCode(): string {
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[bytes[i]! % ROOM_CODE_CHARS.length];
  }
  return code;
}

async function uniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw ERR.INTERNAL;
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

async function getKickedIds(roomId: string) {
  const kicked = await prisma.roomPlayer.findMany({
    where: { roomId, kickedAt: { not: null } },
    select: { id: true, userId: true },
  });
  return {
    kickedPlayerIds: kicked.map((p) => p.id),
    kickedUserIds: kicked.map((p) => p.userId).filter(Boolean) as string[],
  };
}

export async function createRoom(data: {
  hostUserId: string;
  hostDisplayName: string;
  hostAvatarEmoji?: string;
  maxPlayers?: number;
  isPremiumHost: boolean;
}): Promise<{ room: Room; player: RoomPlayer }> {
  const displayName = assertValidDisplayName(data.hostDisplayName);
  const code = await uniqueRoomCode();
  const maxPlayers = GAME_RULES.MAX_PLAYERS;
  const hostAvatar = normalizeAvatarId(data.hostAvatarEmoji) ?? randomAvatarId();

  const room = await prisma.room.create({
    data: {
      code,
      hostUserId: data.hostUserId,
      isPremiumRoom: data.isPremiumHost,
      maxPlayers,
      expiresAt: new Date(Date.now() + ROOM_TTL_MS),
      players: {
        create: {
          userId: data.hostUserId,
          displayName,
          avatarEmoji: hostAvatar,
          isHost: true,
          isReady: false,
          sessionToken: generateSessionToken(),
        },
      },
    },
    include: { players: true },
  });
  return { room, player: room.players[0]! };
}

export async function joinRoom(data: {
  code: string;
  displayName: string;
  userId?: string;
  avatarEmoji?: string;
}): Promise<{ room: Room; player: RoomPlayer }> {
  const normalizedCode = data.code.toUpperCase().trim();
  const displayName = assertValidDisplayName(data.displayName);

  const room = await prisma.room.findUnique({
    where: { code: normalizedCode },
    include: { players: { where: { leftAt: null } } },
  });
  if (!room) throw new AppError('ROOM_NOT_FOUND', 'Room not found', 404);
  if (room.status !== 'LOBBY') throw new AppError('ROOM_CLOSED', 'Room is not accepting players', 400);
  if (room.expiresAt < new Date()) throw new AppError('ROOM_CLOSED', 'Room has expired', 410);
  if (room.players.length >= room.maxPlayers) throw new AppError('ROOM_FULL', 'Room is full', 409);
  if (room.categoryId && data.userId) {
    const category = await prisma.category.findUnique({
      where: { id: room.categoryId },
      select: { ageRating: true },
    });
    if (category?.ageRating === '18+') {
      await assertUserCanAccess18(data.userId);
    }
  }

  if (data.userId) {
    const kicked = await prisma.roomPlayer.findFirst({
      where: { roomId: room.id, userId: data.userId, kickedAt: { not: null } },
    });
    if (kicked) throw new AppError('PLAYER_REMOVED', 'You were removed from this room', 403);

    const existing = room.players.find((p: RoomPlayer) => p.userId === data.userId);
    if (existing) return { room, player: existing };
  }

  const usedAvatars = room.players.map((p: RoomPlayer) => p.avatarEmoji).filter(Boolean) as string[];
  const assignedAvatar = normalizeAvatarId(data.avatarEmoji) ?? randomAvatarId(usedAvatars);

  const player = await prisma.roomPlayer.create({
    data: {
      roomId: room.id,
      userId: data.userId,
      displayName,
      avatarEmoji: assignedAvatar,
      sessionToken: generateSessionToken(),
    },
  });
  return { room, player };
}

export async function validateRoomCode(code: string): Promise<{ valid: boolean; reason?: string }> {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase().trim() } });
  if (!room) return { valid: false, reason: 'not_found' };
  if (room.status !== 'LOBBY') return { valid: false, reason: 'not_joinable' };
  if (room.expiresAt < new Date()) return { valid: false, reason: 'expired' };
  return { valid: true };
}

export async function getRoomByPlayerSession(roomId: string, sessionToken: string): Promise<Room & { players: RoomPlayer[]; games?: { id: string; status: string }[] }> {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player || player.roomId !== roomId || player.leftAt) throw ERR.FORBIDDEN;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: { where: { leftAt: null } },
      games: { where: { status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, take: 1, select: { id: true, status: true } },
    },
  });
  if (!room) throw ERR.NOT_FOUND;
  return room;
}

export async function setPlayerReady(roomId: string, sessionToken: string, isReady: boolean) {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player || player.roomId !== roomId || player.leftAt) throw ERR.FORBIDDEN;
  await prisma.roomPlayer.update({ where: { id: player.id }, data: { isReady } });
  return getRoomByPlayerSession(roomId, sessionToken);
}

export async function leaveRoom(roomId: string, sessionToken: string) {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player || player.roomId !== roomId) throw ERR.FORBIDDEN;

  let newHostId: string | null = null;
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.roomPlayer.update({ where: { id: player.id }, data: { leftAt: new Date(), isReady: false } });
    if (player.isHost) {
      const remaining = await tx.roomPlayer.findMany({
        where: { roomId, leftAt: null, id: { not: player.id } },
        orderBy: { joinedAt: 'asc' },
      });
      if (remaining.length > 0) {
        const newHost = remaining[0]!;
        await tx.roomPlayer.updateMany({ where: { roomId, leftAt: null }, data: { isHost: false } });
        await tx.roomPlayer.update({ where: { id: newHost.id }, data: { isHost: true } });
        const premium = newHost.userId ? await isHostPremium(newHost.userId) : false;
        await tx.room.update({
          where: { id: roomId },
          data: { hostUserId: newHost.userId ?? roomId, isPremiumRoom: premium },
        });
        newHostId = newHost.id;
      } else {
        await tx.room.update({ where: { id: roomId }, data: { status: 'CLOSED' } });
      }
    }
  });

  return {
    room: await getRoomByPlayerSession(roomId, sessionToken).catch(() => prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
    })),
    newHostId,
  };
}

export async function kickPlayer(roomId: string, sessionToken: string, targetPlayerId: string) {
  const host = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!host?.isHost || host.roomId !== roomId || host.leftAt) throw ERR.FORBIDDEN;

  const target = await prisma.roomPlayer.findFirst({
    where: { id: targetPlayerId, roomId, leftAt: null },
  });
  if (!target) throw ERR.NOT_FOUND;
  if (target.isHost) throw ERR.FORBIDDEN;

  await prisma.roomPlayer.update({
    where: { id: target.id },
    data: { leftAt: new Date(), kickedAt: new Date(), isReady: false },
  });

  return getRoomByPlayerSession(roomId, sessionToken);
}

export async function rematchRoom(roomId: string, sessionToken: string) {
  const host = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!host?.isHost || host.roomId !== roomId || host.leftAt) throw ERR.FORBIDDEN;

  await prisma.$transaction(async (tx) => {
    await tx.game.updateMany({
      where: { roomId, status: 'ACTIVE' },
      data: { status: 'ABORTED', completedAt: new Date() },
    });
    await tx.room.update({
      where: { id: roomId },
      data: { status: 'LOBBY', categoryId: null },
    });
    await tx.roomPlayer.updateMany({
      where: { roomId, leftAt: null },
      data: { isReady: false },
    });
  });

  return getRoomByPlayerSession(roomId, sessionToken);
}

export async function selectCategory(roomId: string, sessionToken: string, categoryId: string) {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player?.isHost || player.roomId !== roomId || player.leftAt) throw ERR.FORBIDDEN;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) throw ERR.NOT_FOUND;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.status !== 'LOBBY') throw new AppError('INVALID_GAME_STATE', 'Room not in lobby', 400);
  if (!category.isFree && !room.isPremiumRoom) {
    throw new AppError('PREMIUM_REQUIRED', 'Premium category requires premium host room', 403);
  }
  if (category.ageRating === '18+') {
    await assertUserCanAccess18(room.hostUserId);
    await assertRoomPlayersCanAccess18(roomId);
  }

  return prisma.room.update({ where: { id: roomId }, data: { categoryId } });
}

export async function startGame(roomId: string, sessionToken: string) {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player?.isHost || player.roomId !== roomId || player.leftAt) throw ERR.FORBIDDEN;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: { where: { leftAt: null } } },
  });
  if (!room) throw ERR.NOT_FOUND;

  const activeGame = await prisma.game.findFirst({ where: { roomId, status: 'ACTIVE' } });
  if (activeGame) {
    const fullRoom = await prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
    });
    return { room: fullRoom, gameId: activeGame.id };
  }

  if (!room.categoryId) throw new AppError('INVALID_GAME_STATE', 'Category must be selected', 400);
  if (room.players.length < GAME_RULES.MIN_PLAYERS) {
    throw new AppError('NOT_ENOUGH_PLAYERS', `Minimum ${GAME_RULES.MIN_PLAYERS} players required`, 400);
  }
  if (room.players.some((p: RoomPlayer) => !p.isReady)) {
    throw new AppError('INVALID_GAME_STATE', 'All players must be ready', 400);
  }

  const playerIds = room.players.map((p) => p.id);

  const game = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.room.update({ where: { id: roomId }, data: { status: 'PLAYING' } });
    return tx.game.create({
      data: {
        roomId,
        categoryId: room.categoryId!,
        totalStages: GAME_RULES.TOTAL_QUESTIONS,
        players: {
          create: room.players.map((p: RoomPlayer) => ({
            playerId: p.id,
            userId: p.userId,
            displayName: p.displayName,
          })),
        },
      },
    });
  });

  const contents = await selectContentForGame(
    game.id,
    room.categoryId!,
    room.players.map((p) => p.userId).filter(Boolean) as string[],
    room.isPremiumRoom,
  );
  await initializeGameRounds(game.id, contents, playerIds);

  const fullRoom = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    include: { players: { where: { leftAt: null } }, games: { where: { status: 'ACTIVE' }, take: 1, select: { id: true, status: true } } },
  });

  return { room: fullRoom, gameId: game.id };
}

export async function closeRoom(roomId: string, requesterId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw ERR.NOT_FOUND;
  if (room.hostUserId !== requesterId) throw ERR.FORBIDDEN;
  await prisma.game.updateMany({
    where: { roomId, status: 'ACTIVE' },
    data: { status: 'ABORTED', completedAt: new Date() },
  });
  return prisma.room.update({ where: { id: roomId }, data: { status: 'CLOSED' } });
}

export function mapRoomToDto(room: Room & { players: RoomPlayer[]; games?: { id: string; status: string }[] }, kicked?: { kickedPlayerIds: string[]; kickedUserIds: string[] }) {
  const hostPlayer = room.players.find((p) => p.isHost) ?? room.players[0];
  const activeGame = room.games?.[0];
  return {
    id: room.id,
    code: room.code,
    hostUserId: room.hostUserId,
    hostPlayerId: hostPlayer?.id ?? room.hostUserId,
    state: ROOM_STATUS_MAP[room.status] ?? 'lobby',
    selectedCategoryId: room.categoryId ?? undefined,
    isPremiumRoom: room.isPremiumRoom,
    maxPlayers: room.maxPlayers,
    currentGameId: activeGame?.id,
    players: room.players.map((p: RoomPlayer) => ({
      id: p.id,
      userId: p.userId ?? undefined,
      displayName: p.displayName,
      avatarEmoji: p.avatarEmoji ?? undefined,
      isHost: p.isHost,
      isReady: p.isReady,
      connectionState: 'connected',
      score: 0,
      joinedAt: p.joinedAt.toISOString(),
      sessionToken: p.sessionToken,
    })),
    kickedPlayerIds: kicked?.kickedPlayerIds ?? [],
    kickedUserIds: kicked?.kickedUserIds ?? [],
    expiresAt: room.expiresAt.toISOString(),
    lastActivityAt: room.updatedAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function mapRoomToDtoWithKicked(room: Room & { players: RoomPlayer[]; games?: { id: string; status: string }[] }) {
  const kicked = await getKickedIds(room.id);
  return mapRoomToDto(room, kicked);
}
