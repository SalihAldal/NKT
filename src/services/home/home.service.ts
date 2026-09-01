import { api } from '@/api/client';
import { socialService } from '@/services/social/social.service';
import { notificationCenterService } from '@/services/notifications/notification-center.service';
import type { IncomingQuiz } from '@/types';
import type { SocialActivity } from '@/domain/models/social';
import type { GameRoom } from '@/domain/models/game';
import { ROOM_STATE } from '@/domain/constants/enums';

export interface ActiveGameSummary {
  roomId: string;
  code: string;
  categoryName?: string;
  playerCount: number;
  stage: number;
  state: string;
  isReconnecting: boolean;
}

export interface HomeData {
  incomingQuizzes: IncomingQuiz[];
  newQuizCount: number;
  friendActivity: SocialActivity[];
  unreadNotifications: number;
  activeGame: ActiveGameSummary | null;
  leaderboardRank?: number;
}

const ACTIVE_STATES = new Set<string>([
  ROOM_STATE.LOBBY,
  ROOM_STATE.CATEGORY_SELECTION,
  ROOM_STATE.COUNTDOWN,
  ROOM_STATE.PLAYING,
  ROOM_STATE.ROUND_RESULT,
]);

function toActiveGame(room: GameRoom): ActiveGameSummary | null {
  if (!ACTIVE_STATES.has(room.state)) return null;
  if (room.state === ROOM_STATE.COMPLETED || room.state === ROOM_STATE.CANCELLED) return null;
  const age = Date.now() - new Date(room.updatedAt).getTime();
  if (age > 24 * 60 * 60 * 1000) return null;
  return {
    roomId: room.id,
    code: room.code,
    categoryName: room.selectedCategoryId ?? undefined,
    playerCount: room.players.filter((p) => p.connectionState === 'connected').length,
    stage: room.currentRoundId ? 1 : 0,
    state: room.state,
    isReconnecting: false,
  };
}

class HomeServiceImpl {
  async load(userId: string, membership: { room: GameRoom } | null): Promise<HomeData> {
    const [incoming, activityResult, notifResult, leaderboard] = await Promise.all([
      api.getIncomingQuizzes().catch(() => [] as IncomingQuiz[]),
      socialService.getActivityFeed(userId, 1).catch(() => ({ data: [], hasMore: false })),
      notificationCenterService.list(userId, 1).catch(() => ({ data: [], hasMore: false, unreadCount: 0 })),
      api.getLeaderboard('global', 'weekly').catch(() => []),
    ]);

    const newQuizCount = incoming.filter((q) => q.isNew).length;
    const rankEntry = leaderboard.find((e) => e.isCurrentUser);

    let activeGame: ActiveGameSummary | null = null;
    if (membership?.room) {
      activeGame = toActiveGame(membership.room);
    }

    return {
      incomingQuizzes: incoming,
      newQuizCount,
      friendActivity: activityResult.data.slice(0, 3),
      unreadNotifications: notifResult.unreadCount,
      activeGame,
      leaderboardRank: rankEntry?.rank,
    };
  }
}

export const homeService = new HomeServiceImpl();
