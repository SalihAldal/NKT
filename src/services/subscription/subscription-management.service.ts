import { Linking, Platform } from 'react-native';
import { getPlatform } from '@/utils/platform';
import { logger } from '@/utils/logger';

const STORE_URLS = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;

export const subscriptionManagementService = {
  async openSubscriptionManagement(): Promise<boolean> {
    const platform = getPlatform();
    const url = platform === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return false;
      await Linking.openURL(url);
      return true;
    } catch (err) {
      logger.warn('Failed to open subscription management', err);
      return false;
    }
  },

  getStoreName(): string {
    return Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  },
};
