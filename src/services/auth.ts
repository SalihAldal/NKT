import { apiServices } from '@/api/client';
import { STORAGE_KEYS } from '@/constants';
import { appStorage, secureStorage } from '@/services/storage';
import { analytics } from '@/services/analytics';
import type { User } from '@/types';
import { logger } from '@/utils/logger';
import { env } from '@config/environment';
import { mapProfileToUiUser } from '@/domain/mappers/user.mapper';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  async initialize(): Promise<AuthState> {
    try {
      const token = await secureStorage.get(STORAGE_KEYS.authToken);
      if (!token) return { user: null, isAuthenticated: false, isLoading: false };
      const session = await apiServices.auth.getSession();
      if (!session) return { user: null, isAuthenticated: false, isLoading: false };
      const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
      return { user, isAuthenticated: true, isLoading: false };
    } catch {
      await this.clearSession();
      return { user: null, isAuthenticated: false, isLoading: false };
    }
  }

  async login(username: string, password: string): Promise<{ user: User; recoveryCode?: string }> {
    const session = await apiServices.auth.login({ username, password });
    const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
    await appStorage.setJSON(STORAGE_KEYS.user, user);
    analytics.track({ name: 'login', params: { method: 'username' } });
    return { user, recoveryCode: session.recoveryCode };
  }

  async register(username: string, password: string, birthDate: string): Promise<{ user: User; recoveryCode: string }> {
    const session = await apiServices.auth.register({ username, password, birthDate });
    const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
    await appStorage.setJSON(STORAGE_KEYS.user, user);
    analytics.track({ name: 'signup', params: { method: 'username' } });
    return { user, recoveryCode: session.recoveryCode ?? '' };
  }

  async recover(username: string, recoveryCode: string, newPassword: string): Promise<{ user: User; recoveryCode?: string }> {
    const session = await apiServices.auth.recover({ username, recoveryCode, newPassword });
    const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
    await appStorage.setJSON(STORAGE_KEYS.user, user);
    analytics.track({ name: 'login', params: { method: 'recovery' } });
    return { user, recoveryCode: session.recoveryCode };
  }

  async loginAsGuest(): Promise<User> {
    if (!env.useMockApi) {
      const { session, profile } = await apiServices.auth.createGuestSession('Misafir');
      const guestUser: User = {
        id: session.guestId,
        email: '',
        name: profile.displayName,
        username: profile.username,
        avatar: profile.avatarUrl,
        isPremium: false,
        stats: {
          quizzesCreated: profile.stats.quizzesCreated,
          quizzesCompleted: profile.stats.quizzesCompleted,
          averageScore: profile.stats.averageScore,
          friendsCount: profile.stats.friendsCount,
          badgesCount: profile.stats.badgesCount,
        },
        createdAt: session.createdAt,
      };
      await appStorage.setJSON(STORAGE_KEYS.user, guestUser);
      analytics.track({ name: 'login', params: { method: 'guest' } });
      return guestUser;
    }

    const guestUser: User = {
      id: `guest-${Date.now()}`,
      email: '',
      name: 'Misafir',
      username: 'guest',
      isPremium: false,
      stats: { quizzesCreated: 0, quizzesCompleted: 0, averageScore: 0, friendsCount: 0, badgesCount: 0 },
      createdAt: new Date().toISOString(),
    };
    await appStorage.setJSON(STORAGE_KEYS.user, guestUser);
    analytics.track({ name: 'login', params: { method: 'guest' } });
    return guestUser;
  }

  async logout(): Promise<void> {
    try {
      await apiServices.auth.logout();
    } catch (e) {
      logger.warn('Logout API error', e);
    }
    await this.clearSession();
  }

  async deleteAccount(): Promise<void> {
    await apiServices.user.deleteAccount('me');
    await this.clearSession();
  }

  private async clearSession(): Promise<void> {
    await secureStorage.remove(STORAGE_KEYS.authToken);
    await secureStorage.remove(STORAGE_KEYS.refreshToken);
    await appStorage.remove(STORAGE_KEYS.user);
  }
}

export const authService = new AuthService();
