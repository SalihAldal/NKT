import { logger } from '@/utils/logger';
import { PROVIDER_CONFIG } from '@config/providers';

export interface ErrorContext {
  source: 'app' | 'api' | 'realtime' | 'game' | 'payment' | 'notification';
  userId?: string;
}

const SENSITIVE_KEYS = ['password', 'token', 'receipt', 'secret', 'authorization'];

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = sanitize(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

class ErrorMonitoringService {
  capture(error: unknown, context: ErrorContext, extra?: Record<string, unknown>) {
    if (!PROVIDER_CONFIG.monitoring.enabled) return;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${context.source}] ${message}`, extra ? sanitize(extra) : undefined);
    // Sentry/Crashlytics integration point
  }
}

export const errorMonitoring = new ErrorMonitoringService();
