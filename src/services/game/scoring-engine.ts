import type { GameContentType } from '@/domain/constants/enums';
import { GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import { SCORING_CONFIG } from '@/domain/constants/game';

export interface ScoreInput {
  difficulty: 1 | 2 | 3;
  contentType: GameContentType;
  isCorrect: boolean;
  completed: boolean;
  timeRemainingMs: number;
  totalTimeMs: number;
}

export class ScoringEngine {
  calculate(input: ScoreInput): number {
    const { difficulty, contentType, isCorrect, completed, timeRemainingMs, totalTimeMs } = input;

    if (contentType === GAME_CONTENT_TYPE.QUESTION) {
      if (!isCorrect) return 0;
      let score = SCORING_CONFIG.BASE[difficulty];
      if (totalTimeMs > 0 && timeRemainingMs > 0) {
        score += Math.floor((timeRemainingMs / totalTimeMs) * SCORING_CONFIG.TIME_BONUS_MAX);
      }
      return score;
    }

    if (contentType === GAME_CONTENT_TYPE.CHALLENGE || contentType === GAME_CONTENT_TYPE.PERFORMANCE) {
      if (!completed) return 0;
      let score = SCORING_CONFIG.CHALLENGE_BASE[difficulty] + SCORING_CONFIG.COMPLETION_BONUS;
      if (totalTimeMs > 0 && timeRemainingMs > 0) {
        score += Math.floor((timeRemainingMs / totalTimeMs) * (SCORING_CONFIG.TIME_BONUS_MAX / 2));
      }
      return score;
    }

    return 0;
  }
}

export const scoringEngine = new ScoringEngine();
