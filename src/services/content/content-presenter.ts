import type { GameContent } from '@/domain/models/content';
import type { AnswerType } from '@/domain/constants/enums';

/** Client-safe content view — no correctAnswer leakage */
export interface PublicContentView {
  id: string;
  type: string;
  prompt: string;
  answerType: AnswerType;
  options?: Array<{ id: string; text: string }>;
  timeLimit?: number;
}

export const toAskerView = (
  content: GameContent,
  responderName: string,
): PublicContentView => ({
  id: content.id,
  type: content.type,
  prompt: `${responderName} adlı oyuncuya sor: ${content.prompt}`,
  answerType: content.answerType,
  timeLimit: content.timeLimit,
});

export const toResponderView = (content: GameContent): PublicContentView => ({
  id: content.id,
  type: content.type,
  prompt: content.prompt,
  answerType: content.answerType,
  options: content.options?.map((o) => ({ id: o.id, text: o.text })),
  timeLimit: content.timeLimit,
});

export const stripSensitiveContent = (content: GameContent): Omit<GameContent, 'correctAnswer'> & { correctAnswer?: never } => {
  const { correctAnswer: _, ...safe } = content;
  if (safe.options) {
    safe.options = safe.options.map(({ id, text }) => ({ id, text }));
  }
  return safe as Omit<GameContent, 'correctAnswer'> & { correctAnswer?: never };
};
