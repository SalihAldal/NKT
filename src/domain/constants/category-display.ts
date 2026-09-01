import { GAME_CONTENT_TYPE } from './enums';
import type { CategoryDefinition } from './categories';

type ContentType = (typeof GAME_CONTENT_TYPE)[keyof typeof GAME_CONTENT_TYPE];

export const CONTENT_TYPE_DISPLAY: Record<ContentType, { emoji: string; label: string }> = {
  [GAME_CONTENT_TYPE.QUESTION]: { emoji: '🧠', label: 'Sorular' },
  [GAME_CONTENT_TYPE.CHALLENGE]: { emoji: '🔥', label: 'Cesaret Görevleri' },
  [GAME_CONTENT_TYPE.PERFORMANCE]: { emoji: '🎭', label: 'Performans' },
};

export const getCategoryTypeLines = (category: Pick<CategoryDefinition, 'supportedContentTypes'>) =>
  category.supportedContentTypes.map((t) => {
    const meta = CONTENT_TYPE_DISPLAY[t];
    return `${meta.emoji} ${meta.label}`;
  });

export const getGameplayStyleSummary = (category: Pick<CategoryDefinition, 'supportedContentTypes'>) => {
  const types = category.supportedContentTypes;
  if (types.length === 1 && types[0] === GAME_CONTENT_TYPE.QUESTION) {
    return 'Bu kategoride ağırlıklı olarak sorular bulunur.';
  }
  const labels = types.map((t) => CONTENT_TYPE_DISPLAY[t].label.toLowerCase());
  return `Bu kategoride ${labels.join(', ')} bulunabilir.`;
};

export const STAGE_DISPLAY = {
  1: { label: 'EASY', title: 'İlk seviye tamamlandı 🔥', next: 'MEDIUM' },
  2: { label: 'MEDIUM', title: 'Şimdi işler zorlaşıyor 👀', next: 'HARD' },
  3: { label: 'HARD', title: 'Son aşama!', next: null },
} as const;
