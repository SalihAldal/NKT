import type { SubscriptionApi } from '../contracts/subscription.api';
import { ENTITLEMENT_STATUS, PURCHASE_STATUS } from '@/domain/constants/enums';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { getVerificationProvider } from '@/services/payment/receipt-verification.service';
import { delay } from './data';

export const createMockSubscriptionApi = (): SubscriptionApi => ({
  async getEntitlement(userId) {
    const server = serverEntitlementService.getEntitlement(userId);
    return entitlementService.syncFromServer(server);
  },

  async verifyPurchase(userId, receipt, platform) {
    await delay(200);
    const productId = receipt.includes('weekly') ? 'com.nkt.app.premium.weekly' : 'com.nkt.app.premium.monthly';
    const verifier = getVerificationProvider(platform);
    const result = await verifier.verify({
      userId,
      receipt,
      productId,
      platform,
      transactionId: `api-txn-${Date.now()}`,
    });
    if (!result.valid || !result.entitlement) {
      return { success: false, status: PURCHASE_STATUS.FAILED, error: result.reason };
    }
    await entitlementService.syncFromServer(result.entitlement);
    return {
      success: true,
      status: PURCHASE_STATUS.SUCCESS,
      entitlement: {
        status: result.entitlement.status,
        expiresAt: result.entitlement.expiresAt,
        productId: result.entitlement.productId,
        verified: true,
      },
    };
  },

  async restorePurchases(userId, platform) {
    const server = serverEntitlementService.getEntitlement(userId);
    const hasPremium = server.status === ENTITLEMENT_STATUS.PREMIUM || server.status === ENTITLEMENT_STATUS.GRACE;
    if (hasPremium) {
      await entitlementService.syncFromServer(server);
    }
    return {
      restored: hasPremium,
      entitlement: {
        status: server.status,
        expiresAt: server.expiresAt,
        productId: server.productId,
        verified: server.verifiedAt !== undefined,
      },
    };
  },

  async listSubscriptions() { return []; },
  async listPurchases() { return []; },
});
