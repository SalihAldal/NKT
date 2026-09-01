import type { RoomApi } from '../contracts/room.api';
import type { GameRoom } from '@/domain/models/game';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpRoomApi(request: RequestFn): RoomApi {
  return {
    create: (data) => request('/api/v1/rooms/create', { method: 'POST', body: JSON.stringify(data) }),
    join: (data) => request('/api/v1/rooms/join', { method: 'POST', body: JSON.stringify(data) }),
    leave: (ctx) => request(`/api/v1/rooms/${ctx.roomId}/leave`, { method: 'POST', body: JSON.stringify({ sessionToken: ctx.sessionToken }) }),
    reconnect: (ctx) => request<GameRoom>(`/api/v1/rooms/${ctx.roomId}?sessionToken=${ctx.sessionToken}`),
    setReady: (ctx, isReady) => request<GameRoom>(`/api/v1/rooms/${ctx.roomId}/ready`, { method: 'POST', body: JSON.stringify({ sessionToken: ctx.sessionToken, isReady }) }),
    startGame: async (ctx) => {
      const result = await request<{ room: GameRoom; gameId: string }>(`/api/v1/rooms/${ctx.roomId}/start`, {
        method: 'POST',
        body: JSON.stringify({ sessionToken: ctx.sessionToken }),
      });
      return { ...result.room, currentGameId: result.gameId };
    },
    selectCategory: async (ctx, categoryId) => {
      const room = await request<GameRoom>(`/api/v1/rooms/${ctx.roomId}/category`, { method: 'POST', body: JSON.stringify({ sessionToken: ctx.sessionToken, categoryId }) });
      return { room };
    },
    rematch: (ctx) => request(`/api/v1/rooms/${ctx.roomId}/rematch`, { method: 'POST', body: JSON.stringify({ sessionToken: ctx.sessionToken }) }),
    kickPlayer: (ctx, targetPlayerId) => request(`/api/v1/rooms/${ctx.roomId}/kick`, { method: 'POST', body: JSON.stringify({ sessionToken: ctx.sessionToken, targetPlayerId }) }),
    getRoomState: (ctx) => request<GameRoom>(`/api/v1/rooms/${ctx.roomId}?sessionToken=${ctx.sessionToken}`),
    getByCode: () => { throw new Error('Not supported'); },
    getById: () => { throw new Error('Not supported'); },
    close: (roomId, _requesterId) => request(`/api/v1/rooms/${roomId}/close`, { method: 'POST' }),
    validateCode: (code) => request('/api/v1/rooms/validate-code', { method: 'POST', body: JSON.stringify({ code }) }),
    listActiveRooms: () => { throw new Error('Room discovery not supported'); },
  };
}
