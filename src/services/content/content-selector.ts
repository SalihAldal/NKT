import type {
  ContentSelectionCriteria,
  ContentSelectionResult,
  GameContent,
} from '@/domain/models/content';
import { DIFFICULTY_LEVELS, MODERATION_STATUS } from '@/domain/constants/enums';
import { isPlayableContent } from '@/domain/constants/content';
import { validationError } from '@/services/errors/app-error';

export class DifficultyResolver {
  static normalize(difficulty: number): 1 | 2 | 3 {
    if (!DIFFICULTY_LEVELS.includes(difficulty as 1 | 2 | 3)) {
      throw validationError('Difficulty must be 1, 2, or 3');
    }
    return difficulty as 1 | 2 | 3;
  }

  static resolveForRound(roundNumber: number, maxRounds: number): 1 | 2 | 3 {
    const progress = roundNumber / maxRounds;
    if (progress <= 0.33) return 1;
    if (progress <= 0.66) return 2;
    return 3;
  }
}

/** Deterministic seeded PRNG for testable selection */
export const seededRandom = (seed: string, round = 0): () => number => {
  let h = 0;
  const s = `${seed}:${round}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0xffffffff;
  };
};

export interface ContentSelector {
  select(criteria: ContentSelectionCriteria, pool: GameContent[]): ContentSelectionResult;
}

export class DefaultContentSelector implements ContentSelector {
  select(criteria: ContentSelectionCriteria, pool: GameContent[]): ContentSelectionResult {
    const excludeSet = new Set([
      ...(criteria.excludeIds ?? []),
      ...(criteria.recentHistoryIds ?? []),
      ...(criteria.roomHistoryIds ?? []),
      ...(criteria.playerHistoryIds ?? []),
    ]);

    let filtered = pool.filter(
      (c) =>
        c.categoryId === criteria.categoryId &&
        isPlayableContent(c.active, c.moderationStatus, c.qualityStatus) &&
        c.moderationStatus === MODERATION_STATUS.APPROVED,
    );

    if (criteria.contentTypes?.length) {
      filtered = filtered.filter((c) => criteria.contentTypes!.includes(c.type));
    }

    if (criteria.difficulty !== undefined) {
      const levels = Array.isArray(criteria.difficulty) ? criteria.difficulty : [criteria.difficulty];
      filtered = filtered.filter((c) => levels.includes(c.difficulty));
    }

    if (!criteria.premiumUnlocked) {
      filtered = filtered.filter((c) => !c.premium);
    }

    if (criteria.ageRatingMax) {
      const ratingOrder = ['all', '13+', '16+', '18+'];
      const maxIdx = ratingOrder.indexOf(criteria.ageRatingMax);
      filtered = filtered.filter((c) => ratingOrder.indexOf(c.ageRating) <= maxIdx);
    }

    const beforeExclude = filtered.length;
    filtered = filtered.filter((c) => !excludeSet.has(c.id));
    const excludedDuplicates = beforeExclude - filtered.length;

    const rng = criteria.seed
      ? seededRandom(criteria.seed, criteria.roundNumber ?? 0)
      : Math.random;

    const items = this.weightedSelect(filtered, criteria.count, rng);
    const poolWarning = filtered.length < criteria.count * 2;

    return {
      items,
      excludedDuplicates,
      excludedRecent: criteria.recentHistoryIds?.length ?? 0,
      poolWarning,
    };
  }

  private weightedSelect(
    pool: GameContent[],
    count: number,
    rng: () => number = Math.random,
  ): GameContent[] {
    const selected: GameContent[] = [];
    const remaining = [...pool];

    while (selected.length < count && remaining.length > 0) {
      const weights = remaining.map((c) => 1 / (c.usageCount + 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = rng() * totalWeight;

      for (let i = 0; i < remaining.length; i++) {
        random -= weights[i]!;
        if (random <= 0) {
          selected.push(remaining[i]!);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    return selected;
  }
}

export const contentSelector: ContentSelector = new DefaultContentSelector();

export { contentHistoryService } from './content-history';
export type { ContentHistoryService } from './content-history';
