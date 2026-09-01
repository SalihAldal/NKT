/**
 * HTTP implementation of ApiServices — connects mobile app to production backend.
 */
import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { NetworkError, fetchWithRetry } from '@/services/network/resilient-fetch';
import type { ApiServices } from '../contracts';
import { createHttpAuthApi } from './auth.http';
import { createHttpUserApi } from './user.http';
import { createHttpQuizApi } from './quiz.http';
import { createHttpFriendApi } from './friend.http';
import { createHttpRoomApi } from './room.http';
import { createHttpGameApi } from './game.http';
import { createHttpContentApi } from './content.http';
import { createHttpSubscriptionApi } from './subscription.http';
import { createHttpNotificationApi } from './notification.http';
import { createHttpModerationApi } from './moderation.http';
import { createHttpAnalyticsApi } from './analytics.http';
import { createHttpSocialApi, createHttpInvitationApi } from './social.http';

export interface HttpClientOptions {
  baseUrl?: string;
  onUnauthorized?: () => void;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(baseUrl: string): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await secureStorage.get(STORAGE_KEYS.refreshToken);
      if (!refreshToken) return null;
      const res = await fetchWithRetry(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }, 0);
      if (!res.ok) return null;
      const json = await res.json() as { success: boolean; data: { accessToken: string; refreshToken: string } };
      if (!json.success) return null;
      await secureStorage.set(STORAGE_KEYS.authToken, json.data.accessToken);
      await secureStorage.set(STORAGE_KEYS.refreshToken, json.data.refreshToken);
      return json.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export function createHttpRequest(baseUrl: string, onUnauthorized?: () => void) {
  return async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    const token = await secureStorage.get(STORAGE_KEYS.authToken);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const method = (options.method ?? 'GET').toUpperCase();
    const canRetry = method === 'GET' || method === 'HEAD';

    let response: Response;
    try {
      response = await fetchWithRetry(`${baseUrl}${path}`, { ...options, headers }, canRetry ? 1 : 0);
    } catch (err) {
      if (err instanceof NetworkError) throw err;
      throw new NetworkError('Bağlantı hatası', 'UNKNOWN');
    }

    if (response.status === 401 && !retried) {
      const newToken = await refreshAccessToken(baseUrl);
      if (newToken) return request<T>(path, options, true);
      onUnauthorized?.();
      throw new NetworkError('Oturum süresi doldu', 'SERVER');
    }

    const json = await response.json() as { success: boolean; data?: T; error?: { message: string; code?: string } };
    if (!response.ok || !json.success) {
      throw new NetworkError(json.error?.message ?? `HTTP ${response.status}`, 'SERVER');
    }
    return json.data as T;
  };
}

export function createHttpApiServices(options: HttpClientOptions = {}): ApiServices {
  const baseUrl = options.baseUrl ?? env.apiUrl;
  const request = createHttpRequest(baseUrl, options.onUnauthorized);

  return {
    auth: createHttpAuthApi(request),
    user: createHttpUserApi(request),
    quiz: createHttpQuizApi(request),
    friend: createHttpFriendApi(request),
    invitation: createHttpInvitationApi(request),
    social: createHttpSocialApi(request),
    room: createHttpRoomApi(request),
    game: createHttpGameApi(request),
    content: createHttpContentApi(request).content,
    category: createHttpContentApi(request).category,
    subscription: createHttpSubscriptionApi(request),
    notification: createHttpNotificationApi(request),
    moderation: createHttpModerationApi(request),
    analytics: createHttpAnalyticsApi(request),
  };
}
