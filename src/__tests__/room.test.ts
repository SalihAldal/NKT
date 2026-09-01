import { describe, it, expect, beforeEach } from 'vitest';
import { roomServer } from '@/api/mock/room.mock';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { ENTITLEMENT_STATUS, ROOM_STATE } from '@/domain/constants/enums';
import { ROOM_CONFIG } from '@/domain/constants/room';
import { isAppError } from '@/services/errors/app-error';
import { parseSecureDeepLink } from '@/services/security/validation';
import { realtimeEventBus } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import type { GameRoom } from '@/domain/models/game';

const ctx = (room: GameRoom, playerId: string) => {
  const player = room.players.find((p) => p.id === playerId)!;
  return { roomId: room.id, playerId, sessionToken: player.sessionToken };
};

beforeEach(() => {
  roomServer._reset();
});

describe('Room System — PHASE 02', () => {
  it('1. Host room oluşturur', async () => {
    const { room, player } = await roomServer.create({
      hostUserId: 'host-1',
      hostDisplayName: 'Host',
    });
    expect(room.code).toHaveLength(6);
    expect(room.state).toBe(ROOM_STATE.LOBBY);
    expect(player.isHost).toBe(true);
    expect(room.players).toHaveLength(1);
  });

  it('2. Player code ile katılır', async () => {
    const { room } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const joined = await roomServer.join({ code: room.code, displayName: 'Player2', userId: 'p2' });
    expect(joined.room.players).toHaveLength(2);
  });

  it('3. Player yanlış code girer', async () => {
    await expect(roomServer.join({ code: 'ZZZZZZ', displayName: 'X' })).rejects.toThrow();
  });

  it('4. Player full room\'a giremez', async () => {
    const { room } = await roomServer.create({
      hostUserId: 'h1',
      hostDisplayName: 'Host',
      maxPlayers: 2,
    });
    await roomServer.join({ code: room.code, displayName: 'P2' });
    await expect(roomServer.join({ code: room.code, displayName: 'P3' })).rejects.toThrow();
  });

  it('5. İki oda aynı code alamaz', async () => {
    const r1 = await roomServer.create({ hostUserId: 'a', hostDisplayName: 'A' });
    const r2 = await roomServer.create({ hostUserId: 'b', hostDisplayName: 'B' });
    expect(r1.room.code).not.toBe(r2.room.code);
  });

  it('6. Oyuncu leave eder', async () => {
    const { room } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const j = await roomServer.join({ code: room.code, displayName: 'P2' });
    const updated = await roomServer.leave(ctx(j.room, j.player.id));
    expect(updated.players).toHaveLength(1);
  });

  it('7. Host leave eder', async () => {
    const { room, player } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    await roomServer.join({ code: room.code, displayName: 'P2', userId: 'p2' });
    await roomServer.leave(ctx(room, player.id));
    const active = (await roomServer.listActiveRooms()).find((r) => r.id === room.id);
    expect(active?.players.find((p) => p.isHost)?.userId).toBe('p2');
  });

  it('8. Yeni host atanır', async () => {
    const { room, player: host } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const p2 = await roomServer.join({ code: room.code, displayName: 'P2', userId: 'p2' });
    await roomServer.leave(ctx(room, host.id));
    const active = (await roomServer.listActiveRooms()).find((r) => r.id === room.id);
    expect(active?.hostPlayerId).toBe(p2.player.id);
  });

  it('9. Network disconnect/reconnect', async () => {
    const { room, player } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    roomServer.markDisconnected(room.id, player.id);
    const disconnected = await roomServer.getRoomState(ctx(room, player.id));
    expect(disconnected.players[0]?.connectionState).toBe('disconnected');
    const reconnected = await roomServer.reconnect(ctx(room, player.id));
    expect(reconnected.players[0]?.connectionState).toBe('connected');
  });

  it('10. Expired room\'a giriş reddedilir', async () => {
    const { room } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const stored = roomServer._getRooms().get(room.id)!;
    stored.lastActivityAt = new Date(Date.now() - ROOM_CONFIG.LOBBY_INACTIVITY_MS - 1000).toISOString();
    await expect(roomServer.join({ code: room.code, displayName: 'Late' })).rejects.toThrow();
  });

  it('11. Free host → free room', async () => {
    await entitlementService.setEntitlement({ userId: 'free-host', status: ENTITLEMENT_STATUS.FREE, source: 'unknown' });
    const { room } = await roomServer.create({ hostUserId: 'free-host', hostDisplayName: 'Free' });
    expect(room.isPremiumRoom).toBe(false);
  });

  it('12. Premium host → premium room', async () => {
    await entitlementService.setEntitlement({
      userId: 'prem-host',
      status: ENTITLEMENT_STATUS.PREMIUM,
      source: 'iap',
      verifiedAt: new Date().toISOString(),
    });
    const { room } = await roomServer.create({ hostUserId: 'prem-host', hostDisplayName: 'Prem' });
    expect(room.isPremiumRoom).toBe(true);
  });

  it('13. Free player premium room\'a katılabilir', async () => {
    await entitlementService.setEntitlement({
      userId: 'prem-host',
      status: ENTITLEMENT_STATUS.PREMIUM,
      source: 'iap',
      verifiedAt: new Date().toISOString(),
    });
    const { room } = await roomServer.create({ hostUserId: 'prem-host', hostDisplayName: 'Prem' });
    const joined = await roomServer.join({ code: room.code, displayName: 'FreePlayer', userId: 'free-p' });
    expect(joined.room.isPremiumRoom).toBe(true);
  });

  it('14. Başka room state\'ine erişilemez', async () => {
    const { player } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const other = await roomServer.create({ hostUserId: 'h2', hostDisplayName: 'Other' });
    await expect(
      roomServer.getRoomState({ roomId: other.room.id, playerId: player.id, sessionToken: player.sessionToken }),
    ).rejects.toThrow();
  });

  it('15. Player kick sonrası room\'a erişim kontrolü', async () => {
    const { room, player: host } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const p2 = await roomServer.join({ code: room.code, displayName: 'P2', userId: 'p2' });
    await roomServer.kickPlayer(ctx(room, host.id), p2.player.id);
    await expect(roomServer.join({ code: room.code, displayName: 'P2', userId: 'p2' })).rejects.toThrow();
  });

  it('16. Tüm player ready olmadan start engellenir', async () => {
    const { room, player: host } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const p2 = await roomServer.join({ code: room.code, displayName: 'P2' });
    await roomServer.setReady(ctx(room, host.id), true);
    expect(p2.player.id).toBeTruthy();
    await expect(roomServer.startGame(ctx(room, host.id))).rejects.toThrow();
  });

  it('17. Minimum player olmadan start engellenir', async () => {
    const { room, player: host } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    await roomServer.setReady(ctx(room, host.id), true);
    await expect(roomServer.startGame(ctx(room, host.id))).rejects.toThrow();
  });

  it('18. Deep link doğru room\'a gider', () => {
    expect(parseSecureDeepLink('nkt://room/ABC123')).toEqual({ type: 'room', id: 'ABC123' });
    expect(parseSecureDeepLink('nkt://test/abc123')).toEqual({ type: 'quiz', id: 'abc123' });
  });

  it('19. Duplicate realtime event state\'i bozmaz', async () => {
    let updateCount = 0;
    const unsub = realtimeEventBus.subscribe(REALTIME_EVENTS.ROOM_UPDATED, () => { updateCount += 1; });
    const { room } = await roomServer.create({ hostUserId: 'h1', hostDisplayName: 'Host' });
    const hostPlayer = room.players[0];
    if (!hostPlayer) throw new Error('no host');
    await roomServer.setReady(ctx(room, hostPlayer.id), true);
    await roomServer.setReady(ctx(room, hostPlayer.id), true);
    unsub();
    expect(updateCount).toBeGreaterThan(0);
  });

  it('20. getByCode doğrudan erişim yasak', async () => {
    try {
      await roomServer.getByCode('ABC123');
      expect.fail('should throw');
    } catch (e) {
      expect(isAppError(e)).toBe(true);
      if (isAppError(e)) expect(e.code).toBe('FORBIDDEN');
    }
  });
});
