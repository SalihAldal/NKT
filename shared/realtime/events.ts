/**
 * Canonical Socket.IO event names — keep mobile + server in sync.
 */
export const REALTIME_EVENTS = {
  ROOM_CREATED: 'room.created',
  ROOM_JOINED: 'room.joined',
  ROOM_LEFT: 'room.left',
  ROOM_UPDATED: 'room.updated',
  PLAYER_READY: 'player.ready',
  PLAYER_UPDATED: 'player.updated',
  CATEGORY_SELECTED: 'category.selected',
  HOST_CHANGED: 'host.changed',
  ROOM_CLOSED: 'room.closed',
  GAME_STARTED: 'game.started',
  ROUND_STARTED: 'round.started',
  MATCH_UPDATED: 'match.updated',
  QUESTION_PRESENTED: 'question.presented',
  ANSWER_SUBMITTED: 'answer.submitted',
  ANSWER_TIMEOUT: 'answer.timeout',
  SCORE_UPDATED: 'score.updated',
  ROUND_COMPLETED: 'round.completed',
  STAGE_COMPLETED: 'stage.completed',
  GAME_STATE_UPDATED: 'game.state_updated',
  GAME_COMPLETED: 'game.completed',
  GAME_ABORTED: 'game.aborted',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export const REALTIME_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_CLOSED: 'ROOM_CLOSED',
  INVALID_ANSWER: 'INVALID_ANSWER',
  INVALID_GAME_STATE: 'INVALID_GAME_STATE',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type RealtimeErrorCode = (typeof REALTIME_ERROR_CODES)[keyof typeof REALTIME_ERROR_CODES];

export interface RealtimeSocketError {
  code: RealtimeErrorCode | string;
  message: string;
}
