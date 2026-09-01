import type { AuthApi, AuthSession, LoginDto, RecoverDto, RegisterDto } from '../contracts/auth.api';
import type { GuestSession, Profile } from '@/domain/models/user';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpAuthApi(request: RequestFn): AuthApi {
  return {
    async login(data: LoginDto): Promise<AuthSession> {
      const session = await request<AuthSession>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(data) });
      await secureStorage.set(STORAGE_KEYS.authToken, session.tokens.accessToken);
      await secureStorage.set(STORAGE_KEYS.refreshToken, session.tokens.refreshToken);
      return session;
    },

    async register(data: RegisterDto): Promise<AuthSession> {
      const session = await request<AuthSession>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) });
      await secureStorage.set(STORAGE_KEYS.authToken, session.tokens.accessToken);
      await secureStorage.set(STORAGE_KEYS.refreshToken, session.tokens.refreshToken);
      return session;
    },

    async recover(data: RecoverDto): Promise<AuthSession> {
      const session = await request<AuthSession>('/api/v1/auth/recover', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await secureStorage.set(STORAGE_KEYS.authToken, session.tokens.accessToken);
      await secureStorage.set(STORAGE_KEYS.refreshToken, session.tokens.refreshToken);
      return session;
    },

    async logout(): Promise<void> {
      const refreshToken = await secureStorage.get(STORAGE_KEYS.refreshToken);
      try {
        await request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } finally {
        await secureStorage.remove(STORAGE_KEYS.authToken);
        await secureStorage.remove(STORAGE_KEYS.refreshToken);
      }
    },

    async refreshToken(refreshToken: string) {
      return request('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    },

    async createGuestSession(displayName?: string): Promise<{ session: GuestSession; profile: Profile }> {
      const result = await request<AuthSession>('/api/v1/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      });
      await secureStorage.set(STORAGE_KEYS.authToken, result.tokens.accessToken);
      await secureStorage.set(STORAGE_KEYS.refreshToken, result.tokens.refreshToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        session: {
          guestId: result.user.id,
          displayName: result.profile.displayName,
          createdAt: result.user.createdAt,
          expiresAt,
        },
        profile: result.profile,
      };
    },

    async upgradeGuest(guestId: string, data: RegisterDto): Promise<AuthSession> {
      return request('/api/v1/auth/upgrade-guest', { method: 'POST', body: JSON.stringify({ guestId, ...data }) });
    },

    async getSession(): Promise<AuthSession | null> {
      try {
        const session = await request<Partial<AuthSession>>('/api/v1/auth/session');
        const accessToken = await secureStorage.get(STORAGE_KEYS.authToken);
        const refreshToken = await secureStorage.get(STORAGE_KEYS.refreshToken);
        if (!session.user || !session.profile || !session.entitlement || !accessToken || !refreshToken) {
          return null;
        }
        return {
          user: session.user,
          profile: session.profile,
          entitlement: session.entitlement,
          identity: session.identity,
          tokens: { accessToken, refreshToken },
        };
      } catch {
        return null;
      }
    },

    async signInWithProvider(provider, token) {
      return request<AuthSession>('/api/v1/auth/provider', { method: 'POST', body: JSON.stringify({ provider, token }) });
    },
  };
}
