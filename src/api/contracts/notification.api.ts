import type { Notification } from '@/domain/models/moderation';

export interface NotificationListResponse {
  data: Notification[];
  hasMore: boolean;
  unreadCount: number;
}

export interface NotificationApi {
  list(userId: string, page?: number): Promise<NotificationListResponse>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  registerPushToken(userId: string, token: string): Promise<void>;
}
