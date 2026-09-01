import { apiServices } from '@/api/client';
import { analytics } from '@/services/analytics';
import type { PrivacySettings } from '@/domain/models/social';
import type { ActivityType } from '@/domain/constants/enums';

class SocialServiceImpl {
  async searchUsers(query: string, searcherId: string, page = 1) {
    analytics.track({ name: 'friend_search', params: { queryLength: query.length } });
    return apiServices.social.searchUsers(query, searcherId, page);
  }

  async getActivityFeed(userId: string, page = 1) {
    return apiServices.social.getActivityFeed(userId, page);
  }

  async getSuggestions(userId: string) {
    const suggestions = await apiServices.social.getSuggestions(userId);
    analytics.track({ name: 'friend_suggestion_viewed', params: { count: suggestions.length } });
    return suggestions;
  }

  async hideSuggestion(userId: string, targetUserId: string) {
    await apiServices.social.hideSuggestion(userId, targetUserId);
    analytics.track({ name: 'friend_suggestion_hidden', params: { targetUserId } });
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    return apiServices.social.getPrivacySettings(userId);
  }

  async updatePrivacySettings(userId: string, patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
    return apiServices.social.updatePrivacySettings(userId, patch);
  }

  async recordActivity(
    userId: string,
    type: ActivityType,
    title: string,
    body?: string,
    referenceId?: string,
    referenceType?: 'quiz' | 'game' | 'room',
  ) {
    return apiServices.social.recordActivity(userId, type, title, body, referenceId, referenceType);
  }

  async deleteUserData(userId: string) {
    const { socialServer } = await import('@/api/mock/social-server');
    socialServer.deleteUserData(userId);
  }
}

export const socialService = new SocialServiceImpl();
