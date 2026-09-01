import { getPlatform } from '@/utils/platform';
import type { PurchaseResult, RestoreResult } from '@/domain/models/subscription';
import type { Entitlement } from '@/domain/models/user';
import { ENTITLEMENT_STATUS, PURCHASE_STATUS } from '@/domain/constants/enums';
import { getSubscriptionProducts } from '@config/monetization';
import { env } from '@config/environment';
import { analytics } from '@/services/analytics';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { getVerificationProvider } from './receipt-verification.service';
import { createStorePaymentProvider } from './store.provider';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { logger } from '@/utils/logger';

export interface StoreProduct {
  id: string;
  title: string;
  price: string;
  currency: string;
  plan: string;
}

export interface PaymentProvider {
  platform: 'ios' | 'android';
  getProducts(): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<{ receipt: string; transactionId: string; cancelled?: boolean }>;
  restore(): Promise<Array<{ receipt: string; productId: string; transactionId: string }>>;
}

export interface PaymentService {
  getProducts(): Promise<StoreProduct[]>;
  purchase(userId: string, productId: string, source?: string): Promise<PurchaseResult>;
  restore(userId: string): Promise<RestoreResult>;
  getEntitlement(userId: string): Promise<Entitlement>;
  syncEntitlement(userId: string): Promise<Entitlement>;
}

class MockPaymentProvider implements PaymentProvider {
  platform: 'ios' | 'android' = getPlatform();

  async getProducts(): Promise<StoreProduct[]> {
    const platform = getPlatform();
    return getSubscriptionProducts(platform).map((p) => ({
      id: p.productId,
      title: p.type === 'weekly' ? 'Premium Haftalık' : 'Premium Aylık',
      price: p.price,
      currency: p.currency,
      plan: p.type,
    }));
  }

  async purchase(productId: string) {
    await new Promise((r) => setTimeout(r, 300));
    const prefix = this.platform === 'ios' ? 'mock-receipt' : 'google-mock';
    return {
      receipt: `${prefix}-${productId}`,
      transactionId: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async restore() {
    return [];
  }
}

class PaymentServiceImpl implements PaymentService {
  private provider: PaymentProvider = env.useMockApi ? new MockPaymentProvider() : createStorePaymentProvider();

  setProvider(provider: PaymentProvider) {
    this.provider = provider;
  }

  async getProducts() {
    const platform = this.provider.platform;
    return getSubscriptionProducts(platform).map((p) => ({
      id: p.productId,
      title: p.type === 'weekly' ? 'Premium Haftalık' : 'Premium Aylık',
      price: p.price,
      currency: p.currency,
      plan: p.type,
    }));
  }

  async purchase(userId: string, productId: string, source = 'premium_screen'): Promise<PurchaseResult> {
    analytics.track({ name: 'purchase_started', params: { productId, platform: this.provider.platform, source } });
    try {
      const storeResult = await this.provider.purchase(productId);
      if (storeResult.cancelled) {
        analytics.track({ name: 'purchase_cancelled', params: { productId, platform: this.provider.platform } });
        return { success: false, status: PURCHASE_STATUS.CANCELLED, error: 'Satın alma iptal edildi.' };
      }

      analytics.track({ name: 'purchase_pending', params: { productId, platform: this.provider.platform } });

      const verifier = getVerificationProvider(this.provider.platform);
      const verification = await verifier.verify({
        userId,
        receipt: storeResult.receipt,
        productId,
        platform: this.provider.platform,
        transactionId: storeResult.transactionId,
      });

      if (!verification.valid || !verification.entitlement) {
        analytics.track({ name: 'purchase_failed', params: { productId, platform: this.provider.platform, reason: verification.reason } });
        return { success: false, status: PURCHASE_STATUS.FAILED, error: verification.reason ?? 'Doğrulama başarısız' };
      }

      await entitlementService.syncFromServer(verification.entitlement);
      analytics.track({
        name: 'purchase_success',
        params: { productId, platform: this.provider.platform, source },
      });

      return {
        success: true,
        status: PURCHASE_STATUS.SUCCESS,
        entitlement: {
          status: verification.entitlement.status,
          expiresAt: verification.entitlement.expiresAt,
          productId: verification.entitlement.productId,
          verified: true,
        },
      };
    } catch (e) {
      logger.error('Purchase failed', e);
      analytics.track({ name: 'purchase_failed', params: { productId, platform: this.provider.platform } });
      return { success: false, status: PURCHASE_STATUS.FAILED, error: 'Satın alma tamamlanamadı.' };
    }
  }

  async restore(userId: string): Promise<RestoreResult> {
    analytics.track({ name: 'restore_started', params: { platform: this.provider.platform } });
    try {
      const receipts = await this.provider.restore();
      if (receipts.length === 0) {
        if (!env.useMockApi) {
          const synced = await this.syncEntitlement(userId);
          const restored = EntitlementPolicy.hasPremiumAccess(synced);
          if (restored) {
            analytics.track({ name: 'restore_success', params: { platform: this.provider.platform } });
            return {
              restored: true,
              entitlement: {
                status: synced.status,
                expiresAt: synced.expiresAt,
                productId: synced.productId,
                verified: true,
              },
            };
          }
        } else {
          const server = serverEntitlementService.getEntitlement(userId);
          if (server.status === ENTITLEMENT_STATUS.PREMIUM || server.status === ENTITLEMENT_STATUS.GRACE) {
            await entitlementService.syncFromServer(server);
            analytics.track({ name: 'restore_success', params: { platform: this.provider.platform } });
            return {
              restored: true,
              entitlement: {
                status: server.status,
                expiresAt: server.expiresAt,
                productId: server.productId,
                verified: true,
              },
            };
          }
        }
        analytics.track({ name: 'restore_failed', params: { platform: this.provider.platform, reason: 'no_purchases' } });
        return { restored: false };
      }

      const latest = receipts[0]!;
      const verifier = getVerificationProvider(this.provider.platform);
      const verification = await verifier.verify({
        userId,
        receipt: latest.receipt,
        productId: latest.productId,
        platform: this.provider.platform,
        transactionId: latest.transactionId,
      });

      if (!verification.valid || !verification.entitlement) {
        analytics.track({ name: 'restore_failed', params: { platform: this.provider.platform } });
        return { restored: false };
      }

      await entitlementService.syncFromServer(verification.entitlement);
      analytics.track({ name: 'restore_success', params: { platform: this.provider.platform } });
      return {
        restored: true,
        entitlement: {
          status: verification.entitlement.status,
          expiresAt: verification.entitlement.expiresAt,
          productId: verification.entitlement.productId,
          verified: true,
        },
      };
    } catch {
      analytics.track({ name: 'restore_failed', params: { platform: this.provider.platform } });
      return { restored: false };
    }
  }

  async getEntitlement(userId: string): Promise<Entitlement> {
    return entitlementService.getEntitlement(userId);
  }

  async syncEntitlement(userId: string): Promise<Entitlement> {
    if (!env.useMockApi) {
      try {
        const token = await secureStorage.get(STORAGE_KEYS.authToken);
        const res = await fetch(`${env.apiUrl}/api/v1/subscriptions/entitlement`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json() as { success: boolean; data?: Entitlement };
        if (json.success && json.data) {
          return entitlementService.syncFromServer(json.data);
        }
      } catch (err) {
        logger.warn('Backend entitlement sync failed', err);
      }
    }
    const server = serverEntitlementService.getEntitlement(userId);
    return entitlementService.syncFromServer(server);
  }
}

export const paymentService = new PaymentServiceImpl();
