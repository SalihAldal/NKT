import type { GameApi } from '../contracts/game.api';
import { gameServerRef } from './room.mock';
import { roomServer } from './room.mock';
import { gameError } from '@/services/errors/app-error';

export const createMockGameApi = (): GameApi => ({
  async selectCategory(roomId, categoryId, ctx) {
    const room = roomServer._getRooms().get(roomId);
    if (!room) throw gameError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    const player = room.players.find((p) => p.id === ctx.playerId);
    if (!player?.isHost) throw gameError('NOT_HOST', 'Kategori seçimi host yetkisi gerektirir.');

    await gameServerRef.selectCategory(roomId, categoryId, room.hostUserId);
    const updatedRoom = roomServer._getRooms().get(roomId)!;
    return gameServerRef.createAndStart(updatedRoom, categoryId);
  },

  getPlayerView(ctx) {
    return Promise.resolve(gameServerRef.getPlayerView(ctx.gameId, ctx.playerId));
  },

  submitAnswer(ctx, matchId, answer) {
    return Promise.resolve(gameServerRef.submitAnswer(ctx.gameId, ctx.playerId, matchId, answer));
  },

  resumeGame(roomId, ctx) {
    return Promise.resolve(gameServerRef.resumeGame(roomId, ctx.playerId));
  },

  getSession(gameId, ctx) {
    const session = gameServerRef.getSession(gameId);
    if (!session) throw gameError('GAME_NOT_FOUND', 'Oyun bulunamadı.');
    if (!session.players.some((p) => p.playerId === ctx.playerId)) {
      throw gameError('NOT_MEMBER', 'Bu oyunun üyesi değilsin.');
    }
    return Promise.resolve(JSON.parse(JSON.stringify(session)));
  },
});
