import type { AnalyticsApi } from '../contracts/analytics.api';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpAnalyticsApi(request: RequestFn): AnalyticsApi {
  return {
    track: (event) => request('/api/v1/analytics/events', { method: 'POST', body: JSON.stringify({ events: [event] }) }),
    identify: () => Promise.resolve(),
    flush: () => Promise.resolve(),
  };
}
