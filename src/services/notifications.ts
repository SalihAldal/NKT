import * as Notifications from 'expo-notifications';
import { resolveNotificationRoute } from '@/services/notifications/notification-router';
import { registerPushTokenWithBackend } from '@/services/imageUpload';
import { logger } from '@/utils/logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationRoute = ReturnType<typeof resolveNotificationRoute>;

export interface NotificationService {
  initialize(): Promise<string | null>;
  requestPermission(): Promise<boolean>;
  scheduleLocal(title: string, body: string, data?: Record<string, string>): Promise<void>;
  parseRoute(data: Record<string, unknown>): NotificationRoute | null;
}

class NotificationServiceImpl implements NotificationService {
  async initialize() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return null;
      const token = await Notifications.getExpoPushTokenAsync();
      await registerPushTokenWithBackend(token.data);
      return token.data;
    } catch (e) {
      logger.warn('Notification init failed', e);
      return null;
    }
  }

  async requestPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleLocal(title: string, body: string, data?: Record<string, string>) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null,
    });
  }

  parseRoute(data: Record<string, unknown>): NotificationRoute | null {
    const type = data.type as string | undefined;
    if (!type) return null;
    const stringData: Record<string, string> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (typeof v === 'string') stringData[k] = v;
    });
    return resolveNotificationRoute(type, stringData);
  }
}

export const notificationService = new NotificationServiceImpl();
