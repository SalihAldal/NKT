export const GAME_RULES = {
  TOTAL_QUESTIONS: 30,
  STAGE_SIZE: 10,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
} as const;

export const SCORING_BASE = { 1: 100, 2: 150, 3: 200 } as const;

export function difficultyForRound(roundNumber: number): 1 | 2 | 3 {
  if (roundNumber < 10) return 1;
  if (roundNumber < 20) return 2;
  return 3;
}

export function stageForRound(roundNumber: number): 1 | 2 | 3 {
  return difficultyForRound(roundNumber);
}

export function scoreForAnswer(isCorrect: boolean, roundNumber: number): number {
  if (!isCorrect) return 0;
  const difficulty = difficultyForRound(roundNumber);
  return SCORING_BASE[difficulty];
}
