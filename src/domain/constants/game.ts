import { getCategoryContentTypes } from './categories';

export const GAME_CONFIG = {
  TOTAL_QUESTIONS: 30,
  STAGE_SIZE: 10,
  COUNTDOWN_SECONDS: 3,
  ROUND_RESULT_MS: 2500,
  STAGE_TRANSITION_MS: 3000,
  RECONNECT_GRACE_MS: 60_000,
  MIN_PLAYERS: 2,
} as const;

export const TIMER_CONFIG = {
  EASY_MS: 15_000,
  MEDIUM_MS: 10_000,
  HARD_MS: 7_000,
} as const;

export const SCORING_CONFIG = {
  BASE: { 1: 100, 2: 150, 3: 200 } as const,
  TIME_BONUS_MAX: 50,
  COMPLETION_BONUS: 25,
  CHALLENGE_BASE: { 1: 80, 2: 120, 3: 160 } as const,
} as const;

export type GameStage =
  | 'category_selection'
  | 'countdown'
  | 'round_active'
  | 'round_result'
  | 'stage_transition'
  | 'final_result'
  | 'completed'
  | 'aborted'
  | 'cancelled';

export const STAGE_LABELS: Record<1 | 2 | 3, { title: string; subtitle: string }> = {
  1: { title: 'İlk seviye tamamlandı 🔥', subtitle: 'MEDIUM aşamasına geçiliyor...' },
  2: { title: 'Şimdi işler zorlaşıyor 👀', subtitle: 'HARD aşamasına geçiliyor...' },
  3: { title: 'Son aşama!', subtitle: 'Final turu başlıyor...' },
};

export { getCategoryContentTypes };

export const difficultyForRound = (roundNumber: number): 1 | 2 | 3 => {
  if (roundNumber <= 10) return 1;
  if (roundNumber <= 20) return 2;
  return 3;
};

export const stageForRound = (roundNumber: number): 1 | 2 | 3 => {
  if (roundNumber <= 10) return 1;
  if (roundNumber <= 20) return 2;
  return 3;
};

export const timerForDifficulty = (difficulty: 1 | 2 | 3): number => {
  if (difficulty === 1) return TIMER_CONFIG.EASY_MS;
  if (difficulty === 2) return TIMER_CONFIG.MEDIUM_MS;
  return TIMER_CONFIG.HARD_MS;
};
