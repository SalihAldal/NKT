import type { FriendApi, FriendListResponse, PendingRequestsResponse } from '../contracts/friend.api';
import type { Friendship, FriendProfile } from '@/domain/models/social';
import { socialServer } from './social-server';
import { delay } from './data';

export const createMockFriendApi = (): FriendApi => ({
  async list(userId, page = 1) {
    await delay(200);
    return socialServer.listFriends(userId, page);
  },

  async sendRequest(userId, friendUserId) {
    await delay(200);
    return socialServer.sendFriendRequest(userId, friendUserId);
  },

  async acceptRequest(requestId, userId) {
    await delay(200);
    return socialServer.acceptFriendRequest(requestId, userId);
  },

  async declineRequest(requestId, userId) {
    await delay(200);
    return socialServer.declineFriendRequest(requestId, userId);
  },

  async cancelRequest(requestId, userId) {
    await delay(200);
    socialServer.cancelFriendRequest(requestId, userId);
  },

  async remove(userId, friendUserId) {
    await delay(200);
    socialServer.removeFriend(userId, friendUserId);
  },

  async getPendingRequests(userId) {
    await delay(200);
    return { requests: socialServer.listPendingRequests(userId) };
  },

  async getProfile(viewerId, targetId) {
    await delay(200);
    const profile = socialServer.getFriendProfile(viewerId, targetId);
    if (!profile) throw new Error('Profil görüntülenemiyor.');
    return profile;
  },

  async getFriendIds(userId) {
    await delay(100);
    return socialServer.getFriendUserIds(userId);
  },
});
