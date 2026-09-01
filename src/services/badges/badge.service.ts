import type { UserBadge, BadgeDefinition } from '@/domain/models/badge';
import type { ProfileStats } from '@/domain/models/user';
import { BADGE_DEFINITIONS } from './badge-definitions';

interface BadgeProgressInput {
  stats: ProfileStats;
  gamesWon?: number;
  bestScore?: number;
}

function getProgressValue(def: BadgeDefinition, input: BadgeProgressInput): number {
  const { stats, gamesWon = 0, bestScore = 0 } = input;
  switch (def.condition) {
    case 'quizzes_created': return stats.quizzesCreated;
    case 'quizzes_completed': return stats.quizzesCompleted;
    case 'games_played': return stats.gamesPlayed;
    case 'games_won': return gamesWon;
    case 'friends_count': return stats.friendsCount;
    case 'high_score': return bestScore;
    default: return 0;
  }
}

class BadgeServiceImpl {
  getDefinitions(): BadgeDefinition[] {
    return BADGE_DEFINITIONS;
  }

  computeBadges(input: BadgeProgressInput, unlockedAtMap: Record<string, string> = {}): UserBadge[] {
    return BADGE_DEFINITIONS.map((def) => {
      const progress = Math.min(getProgressValue(def, input), def.target);
      const isUnlocked = progress >= def.target;
      return {
        badgeId: def.id,
        progress,
        target: def.target,
        isUnlocked,
        unlockedAt: unlockedAtMap[def.id] ?? (isUnlocked ? new Date().toISOString() : undefined),
      };
    });
  }

  getUnlockedCount(badges: UserBadge[]): number {
    return badges.filter((b) => b.isUnlocked).length;
  }

  getDefinition(badgeId: string): BadgeDefinition | undefined {
    return BADGE_DEFINITIONS.find((b) => b.id === badgeId);
  }
}

export const badgeService = new BadgeServiceImpl();
