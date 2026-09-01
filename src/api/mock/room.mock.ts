import { v4 as uuidv4 } from 'uuid';
import type { GameRoom, RoomPlayer } from '@/domain/models/game';
import type {
  CreateRoomDto,
  JoinRoomDto,
  RoomActionContext,
  RoomApi,
} from '@/api/contracts/room.api';
import { CONNECTION_STATE, ROOM_STATE } from '@/domain/constants/enums';
import { ROOM_CONFIG } from '@/domain/constants/room';
import {
  assertValidRoomCode,
  generateRoomCode,
  isRoomCodeCollision,
  sanitizeText,
} from '@/services/security/validation';
import { roomError } from '@/services/errors/app-error';
import { roomEntitlementService } from '@/services/entitlement/room-entitlement.service';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { realtimeRoomService } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import { moderationService } from '@/services/moderation/moderation.service';
import { initGameServer } from './game-server';
import { ANIMAL_AVATARS } from '@/domain/constants/animal-avatars';

const rooms = new Map<string, GameRoom>();
const codes = new Set<string>();
const failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const avatarIds = ANIMAL_AVATARS.map((a) => a.id);

const randomAvatarId = (excludedIds: string[] = []) => {
  const pool = avatarIds.filter((avatarId) => !excludedIds.includes(avatarId));
  const source = pool.length > 0 ? pool : avatarIds;
  return source[Math.floor(Math.random() * source.length)]!;
};

export const gameServerRef = initGameServer(
  (roomId) => rooms.get(roomId),
  (room) => { rooms.set(room.id, room); },
);

const touch = (room: GameRoom) => {
  room.lastActivityAt = new Date().toISOString();
  room.updatedAt = room.lastActivityAt;
};

const cloneRoom = (room: GameRoom): GameRoom => JSON.parse(JSON.stringify(room)) as GameRoom;

const publishUpdate = (room: GameRoom) => {
  realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_UPDATED, { room: cloneRoom(room) });
};

const uniqueDisplayName = (room: GameRoom, name: string): string => {
  const base = sanitizeText(name, ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH);
  const existing = room.players.map((p) => p.displayName.toLowerCase());
  if (!existing.includes(base.toLowerCase())) return base;
  let i = 2;
  while (existing.includes(`${base} #${i}`.toLowerCase())) i++;
  return `${base} #${i}`;
};

const assertRoomActive = (room: GameRoom) => {
  if (room.state === ROOM_STATE.CANCELLED || room.state === ROOM_STATE.COMPLETED) {
    throw roomError('ROOM_CLOSED', 'Bu oda kapatılmış.');
  }
  if (new Date(room.expiresAt) < new Date()) {
    room.state = ROOM_STATE.CANCELLED;
    codes.delete(room.code);
    throw roomError('ROOM_EXPIRED', 'Oda süresi dolmuş.');
  }
  const inactiveMs = Date.now() - new Date(room.lastActivityAt).getTime();
  if (inactiveMs > ROOM_CONFIG.LOBBY_INACTIVITY_MS && room.state === ROOM_STATE.LOBBY) {
    room.state = ROOM_STATE.CANCELLED;
    codes.delete(room.code);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_CLOSED, { roomId: room.id, reason: 'expired' });
    throw roomError('ROOM_EXPIRED', 'Oda hareketsizlik nedeniyle kapatıldı.');
  }
};

const assertMember = (room: GameRoom, ctx: RoomActionContext): RoomPlayer => {
  const player = room.players.find((p) => p.id === ctx.playerId);
  if (!player) throw roomError('NOT_MEMBER', 'Bu odanın üyesi değilsin.');
  if (player.sessionToken !== ctx.sessionToken) throw roomError('INVALID_SESSION', 'Oturum geçersiz.');
  if (room.kickedPlayerIds.includes(ctx.playerId)) {
    throw roomError('PLAYER_REMOVED', 'Bu odadan çıkarıldın.');
  }
  return player;
};

const assertHost = (room: GameRoom, ctx: RoomActionContext) => {
  const player = assertMember(room, ctx);
  if (!player.isHost) throw roomError('NOT_HOST', 'Bu işlem için host olmalısın.');
  return player;
};

const migrateHost = (room: GameRoom) => {
  const candidates = room.players
    .filter((p) => p.connectionState !== CONNECTION_STATE.DISCONNECTED)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  const newHost = candidates[0];
  if (!newHost) {
    room.state = ROOM_STATE.CANCELLED;
    codes.delete(room.code);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_CLOSED, { roomId: room.id, reason: 'no_host' });
    return;
  }
  room.players.forEach((p) => { p.isHost = p.id === newHost.id; });
  room.hostUserId = newHost.userId ?? newHost.id;
  room.hostPlayerId = newHost.id;
  const snapshot = roomEntitlementService.evaluateRoom(
    room.hostUserId,
    serverEntitlementService.getEntitlement(room.hostUserId),
    room.id,
  );
  Object.assign(room, { isPremiumRoom: snapshot.isPremiumRoom });
  realtimeRoomService.publish(room.id, REALTIME_EVENTS.HOST_CHANGED, {
    roomId: room.id,
    newHostId: newHost.id,
  });
};

const checkJoinRateLimit = (key: string) => {
  const entry = failedAttempts.get(key);
  if (entry?.lockedUntil && Date.now() < entry.lockedUntil) {
    throw roomError('RATE_LIMITED', 'Çok fazla başarısız deneme. Lütfen bekle.');
  }
};

const recordFailedJoin = (key: string) => {
  const entry = failedAttempts.get(key) ?? { count: 0 };
  entry.count += 1;
  if (entry.count >= ROOM_CONFIG.MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + ROOM_CONFIG.FAILED_ATTEMPT_LOCKOUT_MS;
    entry.count = 0;
  }
  failedAttempts.set(key, entry);
};

export class RoomServer implements RoomApi {
  async create(data: CreateRoomDto) {
    const serverEntitlement = serverEntitlementService.getEntitlement(data.hostUserId);
    const hostEntitlement = await entitlementService.syncFromServer(serverEntitlement);
    const roomId = uuidv4();
    let code = generateRoomCode();
    while (isRoomCodeCollision(code, codes)) code = generateRoomCode();

    const now = new Date().toISOString();
    const hostPlayer: RoomPlayer = {
      id: uuidv4(),
      userId: data.hostUserId,
      displayName: sanitizeText(data.hostDisplayName, ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH),
      avatarEmoji: data.hostAvatarEmoji ?? randomAvatarId(),
      isHost: true,
      isReady: false,
      connectionState: CONNECTION_STATE.CONNECTED,
      score: 0,
      joinedAt: now,
      sessionToken: uuidv4(),
    };

    let room: GameRoom = {
      id: roomId,
      code,
      hostUserId: data.hostUserId,
      hostPlayerId: hostPlayer.id,
      state: ROOM_STATE.LOBBY,
      isPremiumRoom: false,
      maxPlayers: data.maxPlayers ?? ROOM_CONFIG.DEFAULT_MAX_PLAYERS,
      players: [hostPlayer],
      expiresAt: new Date(Date.now() + ROOM_CONFIG.LOBBY_INACTIVITY_MS).toISOString(),
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      kickedPlayerIds: [],
      kickedUserIds: [],
    };

    const snapshot = roomEntitlementService.evaluateRoom(data.hostUserId, hostEntitlement, roomId);
    room = roomEntitlementService.applyToRoom(room, snapshot);

    rooms.set(roomId, room);
    codes.add(code);
    realtimeRoomService.publish(roomId, REALTIME_EVENTS.ROOM_CREATED, { room: cloneRoom(room) });
    return { room: cloneRoom(room), player: { ...hostPlayer } };
  }

  async join(data: JoinRoomDto) {
    const rateKey = data.userId ?? 'anonymous';
    checkJoinRateLimit(rateKey);

    if (!data.displayName.trim()) throw roomError('VALIDATION', 'İsim gerekli.');
    if (moderationService.filter.containsProfanity(data.displayName)) {
      throw roomError('VALIDATION', 'İsim uygun değil.');
    }

    assertValidRoomCode(data.code);
    const room = [...rooms.values()].find((r) => r.code === data.code.toUpperCase());
    if (!room) {
      recordFailedJoin(rateKey);
      throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    }

    assertRoomActive(room);

    const existingKicked = data.userId && room.kickedUserIds.includes(data.userId);
    if (existingKicked) {
      throw roomError('PLAYER_REMOVED', 'Bu odadan çıkarıldın.');
    }

    const reconnecting = room.players.find(
      (p) => p.userId === data.userId && p.connectionState === CONNECTION_STATE.DISCONNECTED,
    );
    if (reconnecting) {
      reconnecting.connectionState = CONNECTION_STATE.CONNECTED;
      reconnecting.disconnectedAt = undefined;
      touch(room);
      publishUpdate(room);
      return { room: cloneRoom(room), player: { ...reconnecting } };
    }

    if (room.players.filter((p) => p.connectionState !== CONNECTION_STATE.DISCONNECTED).length >= room.maxPlayers) {
      throw roomError('ROOM_FULL', 'Oda dolu.');
    }

    const player: RoomPlayer = {
      id: uuidv4(),
      userId: data.userId,
      displayName: uniqueDisplayName(room, data.displayName),
      avatarEmoji: data.avatarEmoji ?? randomAvatarId(room.players.map((p) => p.avatarEmoji ?? '')),
      isHost: false,
      isReady: false,
      connectionState: CONNECTION_STATE.CONNECTED,
      score: 0,
      joinedAt: new Date().toISOString(),
      sessionToken: uuidv4(),
    };

    room.players.push(player);
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_JOINED, { room: cloneRoom(room), player });
    publishUpdate(room);
    return { room: cloneRoom(room), player: { ...player } };
  }

  async leave(ctx: RoomActionContext) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    const player = assertMember(room, ctx);
    const wasHost = player.isHost;

    room.players = room.players.filter((p) => p.id !== ctx.playerId);
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_LEFT, { roomId: room.id, playerId: ctx.playerId });

    if (wasHost && room.players.length > 0) migrateHost(room);
    if (room.players.length === 0) {
      room.state = ROOM_STATE.CANCELLED;
      codes.delete(room.code);
      realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_CLOSED, { roomId: room.id, reason: 'empty' });
    } else {
      publishUpdate(room);
    }
    return cloneRoom(room);
  }

  async reconnect(ctx: RoomActionContext) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertRoomActive(room);
    const player = assertMember(room, ctx);
    player.connectionState = CONNECTION_STATE.CONNECTED;
    player.disconnectedAt = undefined;
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_UPDATED, { room: cloneRoom(room) });
    return cloneRoom(room);
  }

  async setReady(ctx: RoomActionContext, isReady: boolean) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertRoomActive(room);
    const player = assertMember(room, ctx);
    player.isReady = isReady;
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.PLAYER_READY, {
      roomId: room.id,
      playerId: player.id,
      isReady,
    });
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.PLAYER_UPDATED, { room: cloneRoom(room), player: { ...player } });
    publishUpdate(room);
    return cloneRoom(room);
  }

  async selectCategory(ctx: RoomActionContext, categoryId: string) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertHost(room, ctx);
    assertRoomActive(room);

    const activePlayers = room.players.filter((p) => p.connectionState === CONNECTION_STATE.CONNECTED);
    if (activePlayers.length < ROOM_CONFIG.MIN_PLAYERS) {
      throw roomError('NOT_ENOUGH_PLAYERS', `En az ${ROOM_CONFIG.MIN_PLAYERS} oyuncu gerekli.`);
    }
    if (ROOM_CONFIG.REQUIRE_ALL_READY && !activePlayers.every((p) => p.isReady)) {
      throw roomError('NOT_ALL_READY', 'Tüm oyuncular hazır olmalı.');
    }

    await gameServerRef.selectCategory(room.id, categoryId, room.hostUserId);
    touch(room);
    publishUpdate(room);
    return { room: cloneRoom(rooms.get(room.id)!) };
  }

  async rematch(ctx: RoomActionContext) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertHost(room, ctx);
    gameServerRef.clearRoomGame(room.id);
    room.currentGameId = undefined;
    room.selectedCategoryId = undefined;
    room.state = ROOM_STATE.LOBBY;
    room.players.forEach((p) => {
      p.score = 0;
      p.isReady = false;
    });
    touch(room);
    publishUpdate(room);
    return cloneRoom(room);
  }

  async startGame(ctx: RoomActionContext) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertHost(room, ctx);
    assertRoomActive(room);

    const activePlayers = room.players.filter((p) => p.connectionState === CONNECTION_STATE.CONNECTED);
    if (activePlayers.length < ROOM_CONFIG.MIN_PLAYERS) {
      throw roomError('NOT_ENOUGH_PLAYERS', `En az ${ROOM_CONFIG.MIN_PLAYERS} oyuncu gerekli.`);
    }
    if (ROOM_CONFIG.REQUIRE_ALL_READY && !activePlayers.every((p) => p.isReady)) {
      throw roomError('NOT_ALL_READY', 'Tüm oyuncular hazır olmalı.');
    }

    if (!room.selectedCategoryId) {
      room.state = ROOM_STATE.CATEGORY_SELECTION;
      touch(room);
      publishUpdate(room);
      return cloneRoom(room);
    }

    const session = await gameServerRef.createAndStart(room, room.selectedCategoryId);
    room.currentGameId = session.gameId;
    room.state = ROOM_STATE.COUNTDOWN;
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.GAME_STARTED, { roomId: room.id, gameId: session.gameId });
    publishUpdate(room);
    return cloneRoom(room);
  }

  async kickPlayer(ctx: RoomActionContext, targetPlayerId: string) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertHost(room, ctx);
    if (targetPlayerId === ctx.playerId) throw roomError('VALIDATION', 'Kendini çıkaramazsın.');

    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) throw roomError('NOT_FOUND', 'Oyuncu bulunamadı.');

    room.kickedPlayerIds.push(targetPlayerId);
    if (target.userId) room.kickedUserIds.push(target.userId);
    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    touch(room);
    realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_LEFT, { roomId: room.id, playerId: targetPlayerId });
    publishUpdate(room);
    return cloneRoom(room);
  }

  async getRoomState(ctx: RoomActionContext) {
    const room = rooms.get(ctx.roomId);
    if (!room) throw roomError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    assertMember(room, ctx);
    assertRoomActive(room);
    return cloneRoom(room);
  }

  async getByCode(_code: string): Promise<never> {
    throw roomError('FORBIDDEN', 'Doğrudan oda sorgusu yasak.');
  }

  async getById(_roomId: string): Promise<never> {
    throw roomError('FORBIDDEN', 'Doğrudan oda sorgusu yasak.');
  }

  async close(roomId: string, _requesterId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state = ROOM_STATE.CANCELLED;
    room.closedAt = new Date().toISOString();
    codes.delete(room.code);
    realtimeRoomService.publish(roomId, REALTIME_EVENTS.ROOM_CLOSED, { roomId, reason: 'admin' });
  }

  async validateCode(code: string) {
    try {
      assertValidRoomCode(code);
      const room = [...rooms.values()].find((r) => r.code === code.toUpperCase());
      if (!room) return { valid: false, reason: 'not_found' };
      if (room.state === ROOM_STATE.CANCELLED) return { valid: false, reason: 'closed' };
      try { assertRoomActive(room); } catch { return { valid: false, reason: 'expired' }; }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'invalid_format' };
    }
  }

  async listActiveRooms() {
    return [...rooms.values()]
      .filter((r) => r.state === ROOM_STATE.LOBBY || r.state === ROOM_STATE.PLAYING)
      .map(cloneRoom);
  }

  markDisconnected(roomId: string, playerId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connectionState = CONNECTION_STATE.DISCONNECTED;
    player.disconnectedAt = new Date().toISOString();
    player.isReady = false;
    publishUpdate(room);
    setTimeout(() => {
      const r = rooms.get(roomId);
      const p = r?.players.find((pl) => pl.id === playerId);
      if (p?.connectionState === CONNECTION_STATE.DISCONNECTED && p.disconnectedAt) {
        const elapsed = Date.now() - new Date(p.disconnectedAt).getTime();
        if (elapsed >= ROOM_CONFIG.RECONNECT_GRACE_MS) {
          void this.leave({ roomId, playerId, sessionToken: p.sessionToken });
        }
      }
    }, ROOM_CONFIG.RECONNECT_GRACE_MS);
  }

  /** Test helper */
  _reset() {
    rooms.clear();
    codes.clear();
    failedAttempts.clear();
    gameServerRef._reset();
  }

  _getRooms() {
    return rooms;
  }
}

export const roomServer = new RoomServer();

export const createMockRoomApi = (): RoomApi => roomServer;
