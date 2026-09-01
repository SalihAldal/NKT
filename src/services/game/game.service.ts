import { apiServices } from '@/api/client';
import type { GameActionContext } from '@/api/contracts/game.api';
import type { RoomActionContext } from '@/api/contracts/room.api';
import { analytics } from '@/services/analytics';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import type { PlayerGameView } from '@/domain/models/game';

export const gameService = {
  async selectCategoryAndStart(roomCtx: RoomActionContext, categoryId: string) {
    analytics.track({ name: 'category_selected', params: { categoryId, roomId: roomCtx.roomId } });
    const result = await apiServices.room.selectCategory(roomCtx, categoryId);
    analytics.track({ name: 'game_start', params: { roomId: roomCtx.roomId } });
    return result;
  },

  getPlayerView(ctx: GameActionContext): Promise<PlayerGameView> {
    return apiServices.game.getPlayerView(ctx);
  },

  submitAnswer(ctx: GameActionContext, matchId: string, answer: string) {
    return apiServices.game.submitAnswer(ctx, matchId, answer);
  },

  resumeGame(roomId: string, ctx: { playerId: string; sessionToken: string; roomId: string }) {
    return apiServices.game.resumeGame(roomId, {
      roomId,
      playerId: ctx.playerId,
      sessionToken: ctx.sessionToken,
    });
  },

  subscribeToGame(roomId: string, onUpdate: () => void) {
    const events = [
      REALTIME_EVENTS.GAME_STATE_UPDATED,
      REALTIME_EVENTS.ROUND_STARTED,
      REALTIME_EVENTS.ANSWER_SUBMITTED,
      REALTIME_EVENTS.SCORE_UPDATED,
      REALTIME_EVENTS.GAME_COMPLETED,
      REALTIME_EVENTS.STAGE_COMPLETED,
      REALTIME_EVENTS.GAME_ABORTED,
    ] as const;
    const unsubs = events.map((type) =>
      realtimeClient.on(type, (event) => {
        if (event.roomId === roomId) onUpdate();
      }),
    );
    return () => unsubs.forEach((u) => u());
  },
};
