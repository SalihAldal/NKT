import type { NotificationApi } from '../contracts/notification.api';
import type { NotificationListResponse } from '../contracts/notification.api';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpNotificationApi(request: RequestFn): NotificationApi {
  return {
    list: (_userId, page = 1) => request<NotificationListResponse>(`/api/v1/notifications?page=${page}`),
    markRead: (id) => request<void>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: (_userId) => request<void>('/api/v1/notifications/read-all', { method: 'POST' }),
    registerPushToken: (_userId, token) =>
      request<void>('/api/v1/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ token, deviceId: 'mobile', platform: 'ios' }),
      }),
  };
}
