const inFlightRequests = new Map<string, Promise<unknown>>();

export const requestGuard = {
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, promise);
    return promise;
  },

  createAbortable(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timer),
    };
  },
};

export interface RateLimitContract {
  check(key: string): Promise<{ allowed: boolean; retryAfterMs?: number }>;
  record(key: string): Promise<void>;
}

class InMemoryRateLimiter implements RateLimitContract {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  async check(key: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || now > entry.resetAt) return { allowed: true };
    if (entry.count >= this.maxAttempts) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }
    return { allowed: true };
  }

  async record(key: string): Promise<void> {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || now > entry.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
  }
}

export const roomCodeRateLimiter = new InMemoryRateLimiter(10, 60_000);
