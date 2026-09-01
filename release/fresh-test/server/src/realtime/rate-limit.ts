type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export function checkSocketRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function resetSocketRateLimit(key?: string) {
  if (key) buckets.delete(key);
  else buckets.clear();
}
