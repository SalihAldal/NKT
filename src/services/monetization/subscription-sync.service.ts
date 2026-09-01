import { AppState, type AppStateStatus } from 'react-native';
import { paymentService } from '@/services/payment/payment.service';
import { adService } from '@/services/ads';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { analytics } from '@/services/analytics';

let syncListener: (() => void) | null = null;

export const subscriptionSyncService = {
  async syncOnLaunch(userId: string) {
    const entitlement = await paymentService.syncEntitlement(userId);
    adService.setPremiumUser(EntitlementPolicy.hasPremiumAccess(entitlement));
    if (entitlement.status === 'expired') {
      analytics.track({ name: 'subscription_expired', params: { userId } });
    }
    if (entitlement.status === 'grace') {
      analytics.track({ name: 'subscription_grace', params: { userId } });
    }
    if (entitlement.status === 'revoked') {
      analytics.track({ name: 'subscription_revoked', params: { userId } });
    }
    return entitlement;
  },

  startForegroundSync(userId: string) {
    if (syncListener) return;
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        void paymentService.syncEntitlement(userId).then((e) => {
          adService.setPremiumUser(EntitlementPolicy.hasPremiumAccess(e));
        });
      }
    };
    syncListener = AppState.addEventListener('change', handler).remove;
  },

  stopForegroundSync() {
    syncListener?.();
    syncListener = null;
  },
};
