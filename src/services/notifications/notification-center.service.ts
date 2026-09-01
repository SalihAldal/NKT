import { apiServices } from '@/api/client';
import { analytics } from '@/services/analytics';
import { resolveNotificationRoute } from '@/services/notifications/notification-router';
import type { Notification } from '@/domain/models/moderation';
import type { NotificationRoute } from '@/domain/models/moderation';

class NotificationCenterServiceImpl {
  async list(userId: string, page = 1) {
    return apiServices.notification.list(userId, page);
  }

  async markRead(id: string) {
    await apiServices.notification.markRead(id);
  }

  async markAllRead(userId: string) {
    await apiServices.notification.markAllRead(userId);
  }

  resolveRoute(notification: Notification): NotificationRoute {
    analytics.track({
      name: 'notification_opened',
      params: { type: notification.type },
    });
    return resolveNotificationRoute(notification.type, notification.data);
  }

  getUnreadCount(notifications: Notification[]): number {
    return notifications.filter((n) => !n.read).length;
  }
}

export const notificationCenterService = new NotificationCenterServiceImpl();
