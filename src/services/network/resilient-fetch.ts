export class NetworkError extends Error {
  constructor(message: string, public readonly code: 'OFFLINE' | 'TIMEOUT' | 'SERVER' | 'UNKNOWN' = 'UNKNOWN') {
    super(message);
    this.name = 'NetworkError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD']);

let online = true;

export const networkStatus = {
  isOnline: () => online,
  setOnline: (value: boolean) => { online = value; },
};

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (!online) throw new NetworkError('İnternet bağlantısı yok', 'OFFLINE');
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError('İstek zaman aşımına uğradı', 'TIMEOUT');
    }
    if (!online) throw new NetworkError('İnternet bağlantısı yok', 'OFFLINE');
    throw new NetworkError(err instanceof Error ? err.message : 'Ağ hatası', 'UNKNOWN');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 1): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      lastError = err;
      if (!SAFE_RETRY_METHODS.has(method) || attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}
