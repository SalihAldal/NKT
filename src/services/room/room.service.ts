import { apiServices } from '@/api/client';
import type { RoomActionContext } from '@/api/contracts/room.api';
import { analytics } from '@/services/analytics';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import type { GameRoom } from '@/domain/models/game';
import { isAppError } from '@/services/errors/app-error';

export const roomService = {
  async createRoom(hostUserId: string, hostDisplayName: string, hostAvatarEmoji?: string) {
    analytics.track({ name: 'room_create_started', params: {} });
    await realtimeClient.connect();
    const result = await apiServices.room.create({ hostUserId, hostDisplayName, hostAvatarEmoji });
    await realtimeClient.joinRoom(result.room.id, result.player.sessionToken);
    analytics.track({ name: 'room_created', params: { roomId: result.room.id, code: result.room.code } });
    return result;
  },

  async joinRoom(code: string, displayName: string, userId?: string, avatarEmoji?: string) {
    analytics.track({ name: 'room_join_started', params: { code } });
    await realtimeClient.connect();
    try {
      const result = await apiServices.room.join({ code, displayName, userId, avatarEmoji });
      await realtimeClient.joinRoom(result.room.id, result.player.sessionToken);
      analytics.track({ name: 'room_join_success', params: { roomId: result.room.id, code } });
      analytics.track({ name: 'room_player_joined', params: { roomId: result.room.id, code } });
      return result;
    } catch (e) {
      analytics.track({
        name: 'room_join_failed',
        params: { code, reason: isAppError(e) ? e.code : 'unknown' },
      });
      throw e;
    }
  },

  getRoomState(ctx: RoomActionContext) {
    return apiServices.room.getRoomState(ctx);
  },

  setReady(ctx: RoomActionContext, isReady: boolean) {
    if (isReady) analytics.track({ name: 'room_ready', params: { roomId: ctx.roomId } });
    else analytics.track({ name: 'room_unready', params: { roomId: ctx.roomId } });
    return apiServices.room.setReady(ctx, isReady);
  },

  startGame(ctx: RoomActionContext) {
    analytics.track({ name: 'room_start_clicked', params: { roomId: ctx.roomId } });
    return apiServices.room.startGame(ctx).then((room) => {
      analytics.track({ name: 'room_started', params: { roomId: ctx.roomId } });
      return room;
    });
  },

  leave(ctx: RoomActionContext) {
    analytics.track({ name: 'room_player_left', params: { roomId: ctx.roomId } });
    return apiServices.room.leave(ctx);
  },

  reconnect(ctx: RoomActionContext) {
    analytics.track({ name: 'room_reconnect', params: { roomId: ctx.roomId } });
    return apiServices.room.reconnect(ctx);
  },

  kickPlayer(ctx: RoomActionContext, targetPlayerId: string) {
    return apiServices.room.kickPlayer(ctx, targetPlayerId);
  },

  validateCode(code: string) {
    return apiServices.room.validateCode(code);
  },

  subscribeToRoom(roomId: string, onUpdate: (room: GameRoom) => void) {
    return realtimeClient.on(REALTIME_EVENTS.ROOM_UPDATED, (event) => {
      if (event.roomId === roomId) onUpdate(event.payload.room);
    });
  },
};
