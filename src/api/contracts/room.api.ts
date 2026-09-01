import type { GameRoom, RoomPlayer } from '@/domain/models/game';

export interface CreateRoomDto {
  hostUserId: string;
  hostDisplayName: string;
  hostAvatarEmoji?: string;
  maxPlayers?: number;
}

export interface JoinRoomDto {
  code: string;
  displayName: string;
  userId?: string;
  avatarEmoji?: string;
}

export interface RoomActionContext {
  roomId: string;
  playerId: string;
  sessionToken: string;
}

export interface RoomApi {
  create(data: CreateRoomDto): Promise<{ room: GameRoom; player: RoomPlayer }>;
  join(data: JoinRoomDto): Promise<{ room: GameRoom; player: RoomPlayer }>;
  leave(ctx: RoomActionContext): Promise<GameRoom>;
  reconnect(ctx: RoomActionContext): Promise<GameRoom>;
  setReady(ctx: RoomActionContext, isReady: boolean): Promise<GameRoom>;
  startGame(ctx: RoomActionContext): Promise<GameRoom>;
  selectCategory(ctx: RoomActionContext, categoryId: string): Promise<{ room: GameRoom; gameId?: string }>;
  rematch(ctx: RoomActionContext): Promise<GameRoom>;
  kickPlayer(ctx: RoomActionContext, targetPlayerId: string): Promise<GameRoom>;
  getRoomState(ctx: RoomActionContext): Promise<GameRoom>;
  getByCode(code: string): Promise<never>;
  getById(roomId: string): Promise<never>;
  close(roomId: string, requesterId: string): Promise<void>;
  validateCode(code: string): Promise<{ valid: boolean; reason?: string }>;
  listActiveRooms(): Promise<GameRoom[]>;
}
