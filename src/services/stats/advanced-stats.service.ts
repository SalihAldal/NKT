import type { ProfileStats } from '@/domain/models/user';
import { entitlementService } from '@/services/entitlement/entitlement.service';

export interface BasicStats {
  quizzesCreated: number;
  quizzesCompleted: number;
  gamesPlayed: number;
  averageScore: number;
}

export interface AdvancedStats extends BasicStats {
  answerAccuracy: number;
  averageResponseTimeMs: number;
  categoryPerformance: Record<string, number>;
  winRate: number;
  gameHistory: Array<{ gameId: string; score: number; playedAt: string }>;
}

class AdvancedStatsService {
  async getBasicStats(stats: ProfileStats): Promise<BasicStats> {
    return {
      quizzesCreated: stats.quizzesCreated,
      quizzesCompleted: stats.quizzesCompleted,
      gamesPlayed: stats.gamesPlayed,
      averageScore: stats.averageScore,
    };
  }

  async getAdvancedStats(userId: string, stats: ProfileStats): Promise<AdvancedStats | null> {
    const isPremium = await entitlementService.isPremium(userId);
    if (!isPremium) return null;
    return {
      quizzesCreated: stats.quizzesCreated,
      quizzesCompleted: stats.quizzesCompleted,
      gamesPlayed: stats.gamesPlayed,
      averageScore: stats.averageScore,
      answerAccuracy: stats.gamesPlayed > 0 ? Math.min(100, stats.averageScore) : 0,
      averageResponseTimeMs: 0,
      categoryPerformance: {},
      winRate: stats.gamesPlayed > 0 ? Math.round(stats.averageScore / 10) : 0,
      gameHistory: [],
    };
  }
}

export const advancedStatsService = new AdvancedStatsService();
