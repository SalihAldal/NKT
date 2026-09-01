import type { SocialApi } from '../contracts/social.api';
import type { InvitationApi } from '../contracts/invitation.api';
import type { ActivityType, InvitationType } from '@/domain/constants/enums';
import type { Invitation } from '@/domain/models/social';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpSocialApi(request: RequestFn): SocialApi {
  return {
    searchUsers: (query, _searcherId, page = 1) =>
      request(`/api/v1/friends/search?q=${encodeURIComponent(query)}&page=${page}`),
    getActivityFeed: (_userId, page = 1) => request(`/api/v1/social/activity?page=${page}`),
    getSuggestions: (_userId) => request('/api/v1/social/suggestions'),
    hideSuggestion: (_userId, _targetUserId) => request('/api/v1/social/suggestions/hide', { method: 'POST' }),
    getPrivacySettings: (_userId) => request('/api/v1/users/me/privacy'),
    updatePrivacySettings: (_userId, patch) => request('/api/v1/users/me/privacy', { method: 'PATCH', body: JSON.stringify(patch) }),
    recordActivity: async (_userId, _type: ActivityType, _title: string) => null,
  };
}

export function createHttpInvitationApi(request: RequestFn): InvitationApi {
  return {
    send: (senderId, receiverId, type, referenceId) =>
      request<Invitation>('/api/v1/invitations', {
        method: 'POST',
        body: JSON.stringify({ senderId, receiverId, type, referenceId }),
      }),
    accept: (invitationId, _userId) =>
      request<Invitation>(`/api/v1/invitations/${invitationId}/accept`, { method: 'POST' }),
    reject: (invitationId, _userId) =>
      request<Invitation>(`/api/v1/invitations/${invitationId}/reject`, { method: 'POST' }),
    get: (invitationId) => request<Invitation>(`/api/v1/invitations/${invitationId}`),
    list: (_userId, type?: InvitationType) =>
      request<Invitation[]>(`/api/v1/invitations${type ? `?type=${type}` : ''}`),
  };
}
