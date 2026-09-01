import type { AnalyticsApi } from '../contracts/analytics.api';
import { analytics } from '@/services/analytics';

export const createMockAnalyticsApi = (): AnalyticsApi => ({
  async track(event) {
    analytics.track(event);
  },
  async identify(userId, traits) {
    analytics.identify(userId, traits);
  },
  async flush() {},
});
