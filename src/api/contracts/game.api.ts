import type { GameSession, PlayerGameView } from '@/domain/models/game';
import type { RoomActionContext } from '@/api/contracts/room.api';

export interface GameActionContext {
  gameId: string;
  playerId: string;
  sessionToken: string;
}

export interface GameApi {
  selectCategory(roomId: string, categoryId: string, ctx: RoomActionContext): Promise<GameSession>;
  getPlayerView(ctx: GameActionContext): Promise<PlayerGameView>;
  submitAnswer(ctx: GameActionContext, matchId: string, answer: string): Promise<PlayerGameView>;
  resumeGame(roomId: string, ctx: RoomActionContext): Promise<PlayerGameView | null>;
  getSession(gameId: string, ctx: GameActionContext): Promise<GameSession>;
}
