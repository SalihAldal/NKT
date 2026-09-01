import { create } from 'zustand';
import type { User } from '@/types';
import { authService } from '@/services/auth';
import { adService } from '@/services/ads';
import { analytics } from '@/services/analytics';
import { subscriptionSyncService } from '@/services/monetization/subscription-sync.service';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { setMockAuthenticated } from '@/api/client';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  pendingRecoveryCode: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, birthDate: string) => Promise<void>;
  recoverPassword: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  loginAsGuest: () => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setUser: (user: User) => void;
  consumeRecoveryCode: () => string | null;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: false,
  isInitialized: false,
  pendingRecoveryCode: null,

  initialize: async () => {
    set({ isLoading: true });
    const state = await authService.initialize();
    if (state.user) {
      analytics.identify(state.user.id);
      const entitlement = await subscriptionSyncService.syncOnLaunch(state.user.id);
      adService.setPremiumUser(EntitlementPolicy.hasPremiumAccess(entitlement));
      subscriptionSyncService.startForegroundSync(state.user.id);
      set({
        ...state,
        user: { ...state.user, isPremium: EntitlementPolicy.hasPremiumAccess(entitlement) },
        isInitialized: true,
        isLoading: false,
      });
      return;
    }
    set({ ...state, isInitialized: true, isLoading: false });
  },

  login: async (username, password) => {
    set({ isLoading: true });
    const result = await authService.login(username, password);
    const user = result.user;
    setMockAuthenticated(true);
    analytics.identify(user.id);
    const entitlement = await subscriptionSyncService.syncOnLaunch(user.id);
    adService.setPremiumUser(EntitlementPolicy.hasPremiumAccess(entitlement));
    subscriptionSyncService.startForegroundSync(user.id);
    set({ user: { ...user, isPremium: EntitlementPolicy.hasPremiumAccess(entitlement) }, isAuthenticated: true, isGuest: false, isLoading: false });
  },

  register: async (username, password, birthDate) => {
    set({ isLoading: true });
    const result = await authService.register(username, password, birthDate);
    const user = result.user;
    setMockAuthenticated(true);
    analytics.identify(user.id);
    const entitlement = await subscriptionSyncService.syncOnLaunch(user.id);
    subscriptionSyncService.startForegroundSync(user.id);
    set({
      user: { ...user, isPremium: EntitlementPolicy.hasPremiumAccess(entitlement) },
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      pendingRecoveryCode: result.recoveryCode || null,
    });
  },

  recoverPassword: async (username, recoveryCode, newPassword) => {
    set({ isLoading: true });
    const result = await authService.recover(username, recoveryCode, newPassword);
    const user = result.user;
    setMockAuthenticated(true);
    analytics.identify(user.id);
    const entitlement = await subscriptionSyncService.syncOnLaunch(user.id);
    subscriptionSyncService.startForegroundSync(user.id);
    set({
      user: { ...user, isPremium: EntitlementPolicy.hasPremiumAccess(entitlement) },
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      pendingRecoveryCode: result.recoveryCode ?? null,
    });
  },

  loginAsGuest: async () => {
    const user = await authService.loginAsGuest();
    set({ user, isAuthenticated: true, isGuest: true, isLoading: false });
    return user;
  },

  logout: async () => {
    subscriptionSyncService.stopForegroundSync();
    await authService.logout();
    setMockAuthenticated(false);
    analytics.reset();
    adService.setPremiumUser(false);
    set({ user: null, isAuthenticated: false, isGuest: false, pendingRecoveryCode: null });
  },

  deleteAccount: async () => {
    subscriptionSyncService.stopForegroundSync();
    await authService.deleteAccount();
    setMockAuthenticated(false);
    analytics.reset();
    adService.setPremiumUser(false);
    set({ user: null, isAuthenticated: false, isGuest: false, pendingRecoveryCode: null });
  },

  setUser: (user) => {
    adService.setPremiumUser(user.isPremium);
    set({ user });
  },
  consumeRecoveryCode: () => {
    const code = get().pendingRecoveryCode;
    set({ pendingRecoveryCode: null });
    return code;
  },
}));
