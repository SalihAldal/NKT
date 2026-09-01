import type { AnalyticsEvent } from './event-registry';
import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { logger } from '@/utils/logger';

type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
  flush?: () => Promise<void>;
};

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

export function createHttpAnalyticsProvider(): AnalyticsProvider {
  const buffer: Array<{ name: string; params?: Record<string, unknown>; timestamp: string }> = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  const flush = async () => {
    if (buffer.length === 0 || env.useMockApi) return;
    const batch = buffer.splice(0, BATCH_SIZE);
    try {
      const token = await secureStorage.get(STORAGE_KEYS.authToken);
      await fetch(`${env.apiUrl}/api/v1/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ events: batch }),
      });
    } catch (err) {
      logger.warn('Analytics flush failed', err);
      buffer.unshift(...batch);
    }
  };

  if (!flushTimer) {
    flushTimer = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  }

  return {
    track: (event) => {
      buffer.push({ name: event.name, params: event.params, timestamp: new Date().toISOString() });
      if (buffer.length >= BATCH_SIZE) void flush();
    },
    identify: () => undefined,
    reset: () => { buffer.length = 0; },
    flush,
  };
}
