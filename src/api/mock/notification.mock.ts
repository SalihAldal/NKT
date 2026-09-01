import type { NotificationApi } from '../contracts/notification.api';
import { socialServer } from './social-server';
import { delay } from './data';

export const createMockNotificationApi = (): NotificationApi => ({
  async list(userId, page = 1) {
    await delay(200);
    return socialServer.listNotifications(userId, page);
  },

  async markRead(id) {
    await delay(100);
    socialServer.markNotificationRead(id);
  },

  async markAllRead(userId) {
    await delay(100);
    socialServer.markAllNotificationsRead(userId);
  },

  async registerPushToken() {},
});
