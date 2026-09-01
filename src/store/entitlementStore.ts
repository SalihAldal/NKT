import { create } from 'zustand';
import type { Entitlement } from '@/domain/models/user';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';

interface EntitlementStore {
  entitlement: Entitlement | null;
  isLoading: boolean;
  load: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<Entitlement>;
  clear: () => void;
  isPremium: () => boolean;
}

export const useEntitlementStore = create<EntitlementStore>((set, get) => ({
  entitlement: null,
  isLoading: false,

  load: async (userId) => {
    set({ isLoading: true });
    const entitlement = await entitlementService.refreshFromServer(userId);
    set({ entitlement, isLoading: false });
  },

  refresh: async (userId) => {
    const entitlement = await entitlementService.refreshFromServer(userId);
    set({ entitlement });
    return entitlement;
  },

  clear: () => set({ entitlement: null }),

  isPremium: () => {
    const e = get().entitlement;
    return e ? EntitlementPolicy.hasPremiumAccess(e) : false;
  },
}));
