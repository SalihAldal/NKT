import type { ModerationApi } from '../contracts/moderation.api';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpModerationApi(request: RequestFn): ModerationApi {
  return {
    createReport: (data) => request('/api/v1/reports', { method: 'POST', body: JSON.stringify(data) }),
    blockUser: (blockerId, blockedUserId) => request('/api/v1/friends/block', { method: 'POST', body: JSON.stringify({ blockedUserId }) }),
    unblockUser: (blockerId, blockedUserId) => request('/api/v1/friends/unblock', { method: 'POST', body: JSON.stringify({ blockedUserId }) }),
    listReports: () => request('/api/v1/reports'),
    moderateContent: () => { throw new Error('Admin only'); },
  };
}
