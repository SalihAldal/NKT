import type { AnalyticsEvent } from './event-registry';
import { logger } from '@/utils/logger';
import { env } from '@config/environment';
import { createHttpAnalyticsProvider } from './http.provider';

type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
};

const consoleProvider: AnalyticsProvider = {
  track: (event) => logger.debug('Analytics:', event.name, event.params),
  identify: (userId, traits) => logger.debug('Analytics identify:', userId, traits),
  reset: () => logger.debug('Analytics reset'),
};

class AnalyticsService {
  private provider: AnalyticsProvider = env.useMockApi ? consoleProvider : createHttpAnalyticsProvider();

  setProvider(provider: AnalyticsProvider) {
    this.provider = provider;
  }

  track<E extends AnalyticsEvent>(event: E): void {
    this.provider.track(event);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.provider.identify(userId, traits);
  }

  reset(): void {
    this.provider.reset();
  }
}

export const analytics = new AnalyticsService();
export type { AnalyticsEvent } from './event-registry';
