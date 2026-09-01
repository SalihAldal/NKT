type AttemptBucket = { failures: number; resetAt: number; lockedUntil?: number };

const buckets = new Map<string, AttemptBucket>();

const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 5 * 60_000;

function keyFor(ip: string, userId?: string): string {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

export function assertJoinAllowed(ip: string, userId?: string): void {
  const key = keyFor(ip, userId);
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket?.lockedUntil && now < bucket.lockedUntil) {
    throw new Error('JOIN_RATE_LIMITED');
  }
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { failures: 0, resetAt: now + WINDOW_MS });
  }
}

export function recordFailedJoin(ip: string, userId?: string): void {
  const key = keyFor(ip, userId);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { failures: 0, resetAt: now + WINDOW_MS };
  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.lockedUntil = now + LOCKOUT_MS;
    bucket.failures = 0;
  }
  buckets.set(key, bucket);
}

export function clearJoinFailures(ip: string, userId?: string): void {
  buckets.delete(keyFor(ip, userId));
}

export function resetJoinGuard(): void {
  buckets.clear();
}
