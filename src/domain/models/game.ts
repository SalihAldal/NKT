import type { ConnectionState, RoomState } from '../constants/enums';
import type { AnswerType, GameContentType } from '../constants/enums';
import type { GameStage } from '../constants/game';

export interface RoomPlayer {
  id: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  isHost: boolean;
  isReady: boolean;
  connectionState: ConnectionState;
  score: number;
  currentMatchId?: string;
  joinedAt: string;
  disconnectedAt?: string;
  sessionToken: string;
}

export interface GameRoom {
  id: string;
  code: string;
  hostUserId: string;
  hostPlayerId: string;
  state: RoomState;
  selectedCategoryId?: string;
  isPremiumRoom: boolean;
  maxPlayers: number;
  players: RoomPlayer[];
  currentRoundId?: string;
  expiresAt: string;
  lastActivityAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  currentGameId?: string;
  kickedPlayerIds: string[];
  kickedUserIds: string[];
}

export interface GameRound {
  id: string;
  roomId: string;
  roundNumber: number;
  contentId: string;
  startedAt: string;
  endedAt?: string;
}

export interface Match {
  id: string;
  roundId: string;
  playerId: string;
  contentId: string;
  answer?: string;
  isCorrect?: boolean;
  timeSpentMs?: number;
  submittedAt?: string;
}

export interface GameScore {
  playerId: string;
  roomId: string;
  totalScore: number;
  correctCount: number;
  totalRounds: number;
  rank: number;
}

export interface RoomEntitlementSnapshot {
  roomId: string;
  hostUserId: string;
  hostEntitlementStatus: string;
  isPremiumRoom: boolean;
  premiumCategoryIds: string[];
  evaluatedAt: string;
}

export type MatchStatus = 'pending' | 'active' | 'answered' | 'timeout' | 'skipped';
export type PlayerGameRole = 'asker' | 'responder' | 'observer' | 'bye';

export interface GameSessionPlayer {
  playerId: string;
  userId?: string;
  displayName: string;
  avatarEmoji?: string;
  score: number;
  correctCount: number;
  connectionState: ConnectionState;
}

export interface GameSessionMatch {
  id: string;
  roundNumber: number;
  askerPlayerId: string;
  responderPlayerId: string;
  contentId: string;
  contentType: GameContentType;
  answerType: AnswerType;
  difficulty: 1 | 2 | 3;
  answer?: string;
  isCorrect?: boolean;
  completed?: boolean;
  scoreAwarded?: number;
  timeSpentMs?: number;
  submittedAt?: string;
  status: MatchStatus;
  submittedBy?: string;
}

export interface GameRoundPlan {
  roundNumber: number;
  contentId: string;
  difficulty: 1 | 2 | 3;
  stage: 1 | 2 | 3;
  matches: GameSessionMatch[];
  startedAt?: string;
  endsAt?: string;
}

export interface GameSession {
  gameId: string;
  roomId: string;
  categoryId: string;
  contentSelectionSeed: string;
  totalQuestions: number;
  currentQuestion: number;
  currentStage: 1 | 2 | 3;
  stage: GameStage;
  players: GameSessionPlayer[];
  roundPlans: GameRoundPlan[];
  scores: Record<string, number>;
  startedAt?: string;
  completedAt?: string;
  status: 'pending' | 'active' | 'completed' | 'aborted' | 'cancelled';
  countdownEndsAt?: string;
  roundEndsAt?: string;
  submittedMatchIds: string[];
}

export type AnswerUiState = 'idle' | 'answering' | 'submitting' | 'locked' | 'timeout' | 'result';

export interface PlayerScoreEntry {
  playerId: string;
  displayName: string;
  avatarEmoji?: string;
  score: number;
  rank: number;
  correctCount?: number;
  avgResponseMs?: number;
}

export interface FinalGameStats {
  playerId: string;
  displayName: string;
  avatarEmoji?: string;
  score: number;
  rank: number;
  correctCount: number;
  challengeCompletions: number;
  avgResponseMs: number;
}

export interface RoundResultView {
  matchId: string;
  scoreAwarded: number;
  isCorrect?: boolean;
  completed?: boolean;
  totalScore: number;
  responseTimeMs?: number;
  revealedAnswer?: string;
  nextAskerName?: string;
  nextResponderName?: string;
}

export interface PlayerGameView {
  gameId: string;
  roomId: string;
  stage: GameStage;
  currentQuestion: number;
  totalQuestions: number;
  currentStageNum: 1 | 2 | 3;
  role: PlayerGameRole;
  matchId?: string;
  askerName?: string;
  responderName?: string;
  askerAvatar?: string;
  responderAvatar?: string;
  categoryId?: string;
  categoryName?: string;
  prompt?: string;
  contentType?: GameContentType;
  answerType?: AnswerType;
  options?: Array<{ id: string; text: string }>;
  timeRemainingMs?: number;
  roundEndsAt?: string;
  countdownEndsAt?: string;
  countdownSeconds?: number;
  answerState?: AnswerUiState;
  lastScoreDelta?: number;
  scores: PlayerScoreEntry[];
  lastRoundResult?: RoundResultView;
  stageTransition?: { title: string; subtitle: string };
  finalStats?: FinalGameStats[];
  isSyncing?: boolean;
  abortReason?: string;
}
