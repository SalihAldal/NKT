import type { Purchase, PurchaseResult, RestoreResult, Subscription } from '@/domain/models/subscription';
import type { Entitlement } from '@/domain/models/user';

export interface SubscriptionApi {
  getEntitlement(userId: string): Promise<Entitlement>;
  verifyPurchase(userId: string, receipt: string, platform: 'ios' | 'android', productId?: string, transactionId?: string): Promise<PurchaseResult>;
  restorePurchases(userId: string, platform: 'ios' | 'android'): Promise<RestoreResult>;
  listSubscriptions(userId: string): Promise<Subscription[]>;
  listPurchases(userId: string): Promise<Purchase[]>;
}
