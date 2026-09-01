import type { GameApi, GameActionContext } from '../contracts/game.api';
import type { PlayerGameView, GameSession } from '@/domain/models/game';
import type { RoomActionContext } from '../contracts/room.api';
import { mapServerPlayerView, type ServerPlayerViewDto } from './game-view.mapper';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpGameApi(request: RequestFn): GameApi {
  const fetchView = async (ctx: GameActionContext): Promise<PlayerGameView> => {
    const dto = await request<ServerPlayerViewDto>(
      `/api/v1/games/${ctx.gameId}/view?playerId=${ctx.playerId}&sessionToken=${encodeURIComponent(ctx.sessionToken)}`,
    );
    return mapServerPlayerView(dto, ctx.playerId);
  };

  return {
    selectCategory: (_roomId, _categoryId, _ctx) => { throw new Error('Use room.selectCategory'); },
    getPlayerView: fetchView,
    submitAnswer: async (ctx: GameActionContext, roundId: string, answer: string) => {
      const dto = await request<ServerPlayerViewDto>(`/api/v1/games/${ctx.gameId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ playerId: ctx.playerId, sessionToken: ctx.sessionToken, roundId, answer }),
      });
      return mapServerPlayerView(dto, ctx.playerId);
    },
    resumeGame: async (roomId, ctx) => {
      try {
        const dto = await request<ServerPlayerViewDto | null>(
          `/api/v1/games/room/${roomId}/resume?playerId=${ctx.playerId}&sessionToken=${encodeURIComponent(ctx.sessionToken)}`,
        );
        return dto ? mapServerPlayerView(dto, ctx.playerId) : null;
      } catch {
        return null;
      }
    },
    getSession: (gameId, ctx) => request<GameSession>(`/api/v1/games/${gameId}/result`),
  };
}
