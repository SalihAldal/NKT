import type { AnalyticsEvent } from '@/services/analytics/event-registry';

export interface AnalyticsApi {
  track(event: AnalyticsEvent): Promise<void>;
  identify(userId: string, traits?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}
