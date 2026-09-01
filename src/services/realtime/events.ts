import type { GameRoom, Match, RoomPlayer } from '@/domain/models/game';
import { REALTIME_EVENTS as SHARED_EVENTS, REALTIME_ERROR_CODES } from '../../../shared/realtime/events';

export const REALTIME_EVENTS = SHARED_EVENTS;
export const REALTIME_ERROR_CODES_EXPORT = REALTIME_ERROR_CODES;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type RealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface RealtimeSocketError {
  code: string;
  message: string;
}

export interface RealtimeEventMap {
  'room.created': { room: GameRoom };
  'room.joined': { room: GameRoom; player: RoomPlayer };
  'room.left': { roomId: string; playerId: string };
  'room.updated': { room: GameRoom };
  'player.ready': { roomId: string; playerId: string; isReady: boolean };
  'player.updated': { room: GameRoom; player: RoomPlayer };
  'category.selected': { roomId: string; categoryId: string };
  'game.started': { roomId: string; gameId?: string };
  'round.started': { roomId: string; roundNumber: number; contentId: string };
  'match.updated': { roomId: string; match: Match };
  'question.presented': { roomId: string; contentId: string; timeLimit?: number };
  'answer.submitted': { roomId: string; playerId: string; matchId: string };
  'score.updated': { roomId: string; playerId: string; score: number };
  'round.completed': { roomId: string; roundNumber: number };
  'game.completed': { roomId: string; scores: Array<{ playerId: string; score: number }> };
  'game.aborted': { roomId: string; reason: string };
  'game.state_updated': { gameId: string; roomId: string; stage: string; currentQuestion: number };
  'stage.completed': { roomId: string; stage: number };
  'room.closed': { roomId: string; reason: string };
  'host.changed': { roomId: string; newHostId: string };
  'answer.timeout': { roomId: string; playerId: string; matchId: string };
}

export type RealtimeEvent<T extends RealtimeEventType = RealtimeEventType> = {
  type: T;
  payload: RealtimeEventMap[T];
  timestamp: string;
  roomId?: string;
};

export type RealtimeEventHandler<T extends RealtimeEventType> = (
  event: RealtimeEvent<T>,
) => void;

export interface RealtimeClient {
  connect(token?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionState(): RealtimeConnectionState;
  onConnectionState(handler: (state: RealtimeConnectionState) => void): () => void;
  onError(handler: (error: RealtimeSocketError) => void): () => void;
  joinRoom(roomId: string, sessionToken?: string): Promise<void>;
  joinGame(gameId: string, playerId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;
  emit<T extends RealtimeEventType>(type: T, payload: RealtimeEventMap[T]): void;
  on<T extends RealtimeEventType>(type: T, handler: RealtimeEventHandler<T>): () => void;
}

export interface RealtimeRoomService {
  subscribe(roomId: string, handlers: Partial<{
    [K in RealtimeEventType]: RealtimeEventHandler<K>;
  }>): () => void;
  publish<T extends RealtimeEventType>(roomId: string, type: T, payload: RealtimeEventMap[T]): void;
}

export interface RealtimeEventBus {
  publish<T extends RealtimeEventType>(event: RealtimeEvent<T>): void;
  subscribe<T extends RealtimeEventType>(type: T, handler: RealtimeEventHandler<T>): () => void;
}
