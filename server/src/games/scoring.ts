import { difficultyForRound } from './game-rules.js';

export const TIMER_MS = { 1: 15_000, 2: 10_000, 3: 7_000 } as const;
export const SCORING = {
  BASE: { 1: 100, 2: 150, 3: 200 } as const,
  TIME_BONUS_MAX: 50,
  COMPLETION_BONUS: 25,
  CHALLENGE_BASE: { 1: 80, 2: 120, 3: 160 } as const,
} as const;

export function timerForRound(roundNum: number): number {
  return TIMER_MS[difficultyForRound(roundNum)];
}

export function calculateScore(params: {
  contentType: string;
  roundNum: number;
  isCorrect: boolean;
  completed: boolean;
  timeRemainingMs: number;
  totalTimeMs: number;
}): number {
  const difficulty = difficultyForRound(params.roundNum);
  const { contentType, isCorrect, completed, timeRemainingMs, totalTimeMs } = params;

  if (contentType === 'QUESTION') {
    if (!isCorrect) return 0;
    let score = SCORING.BASE[difficulty];
    if (totalTimeMs > 0 && timeRemainingMs > 0) {
      score += Math.floor((timeRemainingMs / totalTimeMs) * SCORING.TIME_BONUS_MAX);
    }
    return score;
  }

  if (contentType === 'CHALLENGE' || contentType === 'PERFORMANCE') {
    if (!completed) return 0;
    let score = SCORING.CHALLENGE_BASE[difficulty] + SCORING.COMPLETION_BONUS;
    if (totalTimeMs > 0 && timeRemainingMs > 0) {
      score += Math.floor((timeRemainingMs / totalTimeMs) * (SCORING.TIME_BONUS_MAX / 2));
    }
    return score;
  }

  return 0;
}
