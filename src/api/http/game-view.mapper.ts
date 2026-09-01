import type { PlayerGameView, PlayerScoreEntry } from '@/domain/models/game';
import { ANSWER_TYPE, GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import type { GameStage } from '@/domain/constants/game';
import { stageForRound } from '@/domain/constants/game';

export interface ServerPlayerViewDto {
  gameId: string;
  roomId: string;
  status: string;
  currentStage: number;
  totalStages: number;
  categoryName?: string;
  players: Array<{ id: string; displayName: string }>;
  scores: Array<{ playerId: string; score: number; rank: number }>;
  role?: 'asker' | 'responder' | 'observer' | 'bye';
  matchId?: string;
  askerName?: string;
  responderName?: string;
  timeRemainingMs?: number;
  totalTimeMs?: number;
  currentQuestion: {
    id: string;
    roundId: string;
    type: string;
    prompt: string;
    options?: unknown;
    difficulty: number;
  } | null;
  hasAnswered: boolean;
}

function mapContentType(type?: string) {
  if (type === 'challenge') return GAME_CONTENT_TYPE.CHALLENGE;
  if (type === 'performance') return GAME_CONTENT_TYPE.PERFORMANCE;
  return GAME_CONTENT_TYPE.QUESTION;
}

function mapOptions(raw: unknown): Array<{ id: string; text: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((item): item is { id: string; text: string } => Boolean(item && typeof item === 'object' && 'id' in item && 'text' in item))
    .map((item) => ({ id: String(item.id), text: String(item.text) }));
}

function mapStage(status: string, hasQuestion: boolean, hasAnswered: boolean): GameStage {
  if (status === 'completed') return 'final_result';
  if (status === 'aborted') return 'aborted';
  if (!hasQuestion) return 'round_result';
  if (hasAnswered) return 'round_result';
  return 'round_active';
}

function mapAnswerType(contentType: string, options?: Array<{ id: string; text: string }>) {
  if (contentType === GAME_CONTENT_TYPE.CHALLENGE || contentType === GAME_CONTENT_TYPE.PERFORMANCE) {
    return ANSWER_TYPE.ACTION;
  }
  return options?.length ? ANSWER_TYPE.CHOICE : ANSWER_TYPE.TEXT;
}

export function mapServerPlayerView(dto: ServerPlayerViewDto, playerId: string): PlayerGameView {
  const scores: PlayerScoreEntry[] = dto.scores.map((s) => {
    const player = dto.players.find((p) => p.id === s.playerId);
    return {
      playerId: s.playerId,
      displayName: player?.displayName ?? 'Oyuncu',
      score: s.score,
      rank: s.rank,
    };
  });

  const question = dto.currentQuestion;
  const stage = mapStage(dto.status, Boolean(question), dto.hasAnswered);
  const roundIndex = dto.currentStage;
  const contentType = mapContentType(question?.type);
  const options = mapOptions(question?.options);

  return {
    gameId: dto.gameId,
    roomId: dto.roomId,
    stage,
    currentQuestion: roundIndex + 1,
    totalQuestions: dto.totalStages,
    currentStageNum: stageForRound(roundIndex + 1),
    role: dto.role ?? (dto.hasAnswered ? 'observer' : question ? 'responder' : 'observer'),
    matchId: dto.matchId ?? question?.roundId,
    askerName: dto.askerName,
    responderName: dto.responderName,
    categoryName: dto.categoryName,
    prompt: question?.prompt,
    contentType,
    answerType: mapAnswerType(contentType, options),
    options,
    timeRemainingMs: dto.timeRemainingMs,
    answerState: dto.hasAnswered ? 'locked' : 'idle',
    scores,
    finalStats: dto.status === 'completed'
      ? scores.map((s) => ({
          playerId: s.playerId,
          displayName: s.displayName,
          score: s.score,
          rank: s.rank,
          correctCount: 0,
          challengeCompletions: 0,
          avgResponseMs: 0,
        }))
      : undefined,
  };
}
