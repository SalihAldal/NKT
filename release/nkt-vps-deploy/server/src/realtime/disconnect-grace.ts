import { prisma } from '../database/prisma.js';
import { leaveRoom } from '../rooms/room.service.js';
import { publishHostChanged, publishRoomClosed, publishFullRoomUpdate } from './publish.js';
import { logger } from '../common/logger.js';

const RECONNECT_GRACE_MS = 60_000;
const hostGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const playerGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(roomId: string, playerId: string) {
  return `${roomId}:${playerId}`;
}

export function scheduleHostDisconnectGrace(roomId: string, playerId: string, sessionToken: string) {
  const key = timerKey(roomId, playerId);
  clearHostGrace(key);
  const timer = setTimeout(() => {
    void (async () => {
      try {
        const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
        if (!player || player.leftAt) return;
        await leaveRoom(roomId, sessionToken);
        const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: { where: { leftAt: null } } } });
        if (!room || room.players.length === 0) {
          await publishRoomClosed(roomId, 'no_host');
          return;
        }
        const newHost = room.players.find((p) => p.isHost);
        if (newHost) await publishHostChanged(roomId, newHost.id);
      } catch (err) {
        logger.warn({ err, roomId, playerId }, 'Host grace migration failed');
      } finally {
        hostGraceTimers.delete(key);
      }
    })();
  }, RECONNECT_GRACE_MS);
  hostGraceTimers.set(key, timer);
}

export function schedulePlayerDisconnectGrace(roomId: string, playerId: string, sessionToken: string) {
  const key = timerKey(roomId, playerId);
  clearPlayerGrace(key);
  const timer = setTimeout(() => {
    void (async () => {
      try {
        const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
        if (!player || player.leftAt) return;
        await leaveRoom(roomId, sessionToken);
        await publishFullRoomUpdate(roomId);
      } catch (err) {
        logger.warn({ err, roomId, playerId }, 'Player grace leave failed');
      } finally {
        playerGraceTimers.delete(key);
      }
    })();
  }, RECONNECT_GRACE_MS);
  playerGraceTimers.set(key, timer);
}

export function clearDisconnectGrace(roomId: string, playerId: string) {
  const key = timerKey(roomId, playerId);
  clearHostGrace(key);
  clearPlayerGrace(key);
}

function clearHostGrace(key: string) {
  const timer = hostGraceTimers.get(key);
  if (timer) clearTimeout(timer);
  hostGraceTimers.delete(key);
}

function clearPlayerGrace(key: string) {
  const timer = playerGraceTimers.get(key);
  if (timer) clearTimeout(timer);
  playerGraceTimers.delete(key);
}

export async function cleanupExpiredRooms() {
  const expired = await prisma.room.findMany({
    where: { expiresAt: { lt: new Date() }, status: { in: ['LOBBY', 'PLAYING'] } },
    take: 50,
  });
  for (const room of expired) {
    await prisma.room.update({ where: { id: room.id }, data: { status: 'CLOSED' } });
    await publishRoomClosed(room.id, 'expired');
  }
  return expired.length;
}

export function resetGraceTimersForTests() {
  for (const timer of hostGraceTimers.values()) clearTimeout(timer);
  for (const timer of playerGraceTimers.values()) clearTimeout(timer);
  hostGraceTimers.clear();
  playerGraceTimers.clear();
}
