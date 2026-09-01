import type { GameContent } from '@/domain/models/content';
import { CONTENT_QUALITY_STATUS } from '@/domain/constants/content';
import { MODERATION_STATUS } from '@/domain/constants/enums';

export type QualityLabel = 'Excellent' | 'Good' | 'Review' | 'Poor';

export const getQualityLabel = (score: number): QualityLabel => {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Review';
  return 'Poor';
};

export const computeQualityScore = (content: Partial<GameContent>): number => {
  let score = 85;

  if (content.moderationStatus === MODERATION_STATUS.APPROVED) score += 5;
  if (content.moderationStatus === MODERATION_STATUS.REJECTED) score -= 40;
  if (content.moderationStatus === MODERATION_STATUS.PENDING) score -= 10;

  if (content.qualityStatus === CONTENT_QUALITY_STATUS.ACTIVE) score += 5;
  if (content.qualityStatus === CONTENT_QUALITY_STATUS.REJECTED) score -= 30;
  if (content.qualityStatus === CONTENT_QUALITY_STATUS.DRAFT) score -= 5;

  const prompt = content.prompt ?? '';
  if (prompt.length < 15) score -= 15;
  if (prompt.length > 200) score -= 5;
  if (prompt.includes('sorusu ') && /\d+$/.test(prompt)) score -= 50;

  if ((content.safetyFlags?.length ?? 0) > 0) score -= 20;

  const usage = content.usageCount ?? 0;
  const skips = content.skipCount ?? 0;
  const reports = content.reportCount ?? 0;
  const completions = content.completionCount ?? 0;

  if (usage > 0) {
    const completionRate = completions / usage;
    if (completionRate > 0.7) score += 5;
    if (completionRate < 0.3) score -= 5;
    const skipRate = skips / usage;
    if (skipRate > 0.5) score -= 10;
    const reportRate = reports / usage;
    if (reportRate > 0.1) score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const computeAverageQualityScore = (items: GameContent[]): number => {
  if (!items.length) return 0;
  const sum = items.reduce((a, i) => a + (i.qualityScore ?? computeQualityScore(i)), 0);
  return Math.round(sum / items.length);
};
