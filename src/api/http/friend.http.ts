import type { FriendApi } from '../contracts/friend.api';
import type { Friendship, FriendProfile } from '@/domain/models/social';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpFriendApi(request: RequestFn): FriendApi {
  return {
    list: async (userId, page = 1) => {
      const profiles = await request<FriendProfile[]>(`/api/v1/friends?page=${page}`);
      return { data: profiles, hasMore: false };
    },
    sendRequest: (userId, friendUserId) =>
      request<Friendship>('/api/v1/friends/request', { method: 'POST', body: JSON.stringify({ receiverId: friendUserId }) }),
    acceptRequest: (requestId, _userId) =>
      request<Friendship>('/api/v1/friends/accept', { method: 'POST', body: JSON.stringify({ friendshipId: requestId }) }),
    declineRequest: (requestId, _userId) =>
      request<Friendship>('/api/v1/friends/decline', { method: 'POST', body: JSON.stringify({ friendshipId: requestId }) }),
    cancelRequest: (requestId, _userId) =>
      request<void>(`/api/v1/friends/${requestId}`, { method: 'DELETE' }),
    remove: (userId, friendUserId) =>
      request<void>(`/api/v1/friends/${friendUserId}`, { method: 'DELETE' }),
    getPendingRequests: async (userId) => {
      const result = await request<{ requests: Friendship[] }>('/api/v1/friends/pending');
      return { requests: result.requests };
    },
    getProfile: (viewerId, targetId) => request<FriendProfile>(`/api/v1/users/${targetId}`),
    getFriendIds: async (userId) => {
      const profiles = await request<FriendProfile[]>('/api/v1/friends');
      return profiles.map((p) => p.userId);
    },
  };
}
