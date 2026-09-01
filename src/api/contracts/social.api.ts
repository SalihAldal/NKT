import type {
  PrivacySettings,
  SocialActivity,
  FriendSuggestion,
  UserSearchResult,
} from '@/domain/models/social';
import type { ActivityType } from '@/domain/constants/enums';

export interface SocialApi {
  searchUsers(
    query: string,
    searcherId: string,
    page?: number,
  ): Promise<{ data: UserSearchResult[]; hasMore: boolean; total: number }>;
  getActivityFeed(
    userId: string,
    page?: number,
  ): Promise<{ data: SocialActivity[]; hasMore: boolean }>;
  getSuggestions(userId: string): Promise<FriendSuggestion[]>;
  hideSuggestion(userId: string, targetUserId: string): Promise<void>;
  getPrivacySettings(userId: string): Promise<PrivacySettings>;
  updatePrivacySettings(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings>;
  recordActivity(
    userId: string,
    type: ActivityType,
    title: string,
    body?: string,
    referenceId?: string,
    referenceType?: 'quiz' | 'game' | 'room',
  ): Promise<SocialActivity | null>;
}
