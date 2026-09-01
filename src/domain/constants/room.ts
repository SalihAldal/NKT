export const ROOM_CONFIG = {
  MIN_PLAYERS: 2,
  DEFAULT_MAX_PLAYERS: 8,
  LOBBY_INACTIVITY_MS: 30 * 60 * 1000,
  RECONNECT_GRACE_MS: 60 * 1000,
  REQUIRE_ALL_READY: true,
  CODE_LENGTH: 6,
  MAX_DISPLAY_NAME_LENGTH: 20,
  JOIN_RATE_LIMIT_MAX: 10,
  JOIN_RATE_LIMIT_WINDOW_MS: 60_000,
  FAILED_ATTEMPT_LOCKOUT_MS: 5 * 60 * 1000,
  MAX_FAILED_ATTEMPTS: 5,
} as const;

export const AVATAR_EMOJIS = ['lion', 'wolf', 'bear', 'rabbit', 'eagle', 'shark', 'turtle', 'horse', 'cow', 'pig'] as const;

export type LobbyUiState =
  | 'loading'
  | 'empty'
  | 'waiting'
  | 'ready'
  | 'host_starting'
  | 'disconnected'
  | 'room_expired'
  | 'room_full'
  | 'invalid_room'
  | 'player_removed'
  | 'network_error';
