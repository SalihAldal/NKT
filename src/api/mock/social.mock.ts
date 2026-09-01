import type { SocialApi } from '../contracts/social.api';
import { socialServer } from './social-server';
import { delay } from './data';

export const createMockSocialApi = (): SocialApi => ({
  async searchUsers(query, searcherId, page) {
    await delay(300);
    return socialServer.searchUsers(query, searcherId, page);
  },

  async getActivityFeed(userId, page) {
    await delay(200);
    return socialServer.getActivityFeed(userId, page);
  },

  async getSuggestions(userId) {
    await delay(200);
    return socialServer.getSuggestions(userId);
  },

  async hideSuggestion(userId, targetUserId) {
    await delay(100);
    socialServer.hideSuggestion(userId, targetUserId);
  },

  async getPrivacySettings(userId) {
    await delay(100);
    return socialServer.getPrivacySettings(userId);
  },

  async updatePrivacySettings(userId, patch) {
    await delay(200);
    return socialServer.updatePrivacySettings(userId, patch);
  },

  async recordActivity(userId, type, title, body, referenceId, referenceType) {
    await delay(50);
    return socialServer.recordActivity(userId, type, title, body, referenceId, referenceType);
  },
});
