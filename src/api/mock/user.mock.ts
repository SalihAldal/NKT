import type { UserApi } from '../contracts/user.api';
import type { Profile } from '@/domain/models/user';
import { MOCK_USER, delay } from './data';

export const createMockUserApi = (): UserApi => ({
  async getProfile(userId) {
    await delay();
    return {
      userId,
      displayName: MOCK_USER.name,
      username: MOCK_USER.username,
      avatarUrl: MOCK_USER.avatar,
      locale: 'tr',
      stats: {
        quizzesCreated: MOCK_USER.stats.quizzesCreated,
        quizzesCompleted: MOCK_USER.stats.quizzesCompleted,
        gamesPlayed: 0,
        averageScore: MOCK_USER.stats.averageScore,
        friendsCount: MOCK_USER.stats.friendsCount,
        badgesCount: MOCK_USER.stats.badgesCount,
      },
    };
  },
  async updateProfile(userId, data) {
    const profile = await this.getProfile(userId);
    return { ...profile, ...data };
  },
  async deleteAccount() {},
  async search() {
    return { data: [], total: 0, page: 1, pageSize: 20, hasMore: false };
  },
});
