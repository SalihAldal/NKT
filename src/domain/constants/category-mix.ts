import { GAME_CONTENT_TYPE } from './enums';

export type ContentMix = Partial<Record<(typeof GAME_CONTENT_TYPE)[keyof typeof GAME_CONTENT_TYPE], number>>;

/** Default content type mix ratios per category (percentages, should sum ~100) */
export const CATEGORY_CONTENT_MIX: Record<string, ContentMix> = {
  'cat-korku': { question: 50, challenge: 25, performance: 25 },
  'cat-cesaret': { question: 20, challenge: 50, performance: 30 },
  'cat-taniyorsun': { question: 80, challenge: 10, performance: 10 },
  'cat-utandiran': { question: 70, challenge: 20, performance: 10 },
  'cat-gece': { question: 90, challenge: 5, performance: 5 },
  'cat-ask-iliski': { question: 80, challenge: 10, performance: 10 },
  'cat-itiraf': { question: 85, challenge: 15 },
  'cat-parti': { question: 30, challenge: 40, performance: 30 },
  'cat-eglence': { question: 40, challenge: 30, performance: 30 },
  'cat-black-humor': { question: 70, challenge: 20, performance: 10 },
  'cat-tuhaf-absurt': { question: 40, challenge: 30, performance: 30 },
  'cat-zor-sorular': { question: 85, challenge: 10, performance: 5 },
  'cat-film': { question: 90, challenge: 5, performance: 5 },
  'cat-muzik': { question: 90, challenge: 5, performance: 5 },
  'cat-spor': { question: 90, challenge: 5, performance: 5 },
  'cat-oyun': { question: 80, challenge: 10, performance: 10 },
  'cat-cocukluk': { question: 80, challenge: 10, performance: 10 },
  'cat-18': { question: 70, challenge: 20, performance: 10 },
  'cat-kim-daha': { question: 70, challenge: 25, performance: 5 },
  'cat-arkadaslik-krizi': { question: 60, challenge: 25, performance: 15 },
};

export const getCategoryContentMix = (categoryId: string): ContentMix =>
  CATEGORY_CONTENT_MIX[categoryId] ?? { question: 70, challenge: 20, performance: 10 };
