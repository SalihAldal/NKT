import type { SubscriptionApi } from '../contracts/subscription.api';
import type { Entitlement } from '@/domain/models/user';
import type { Purchase, PurchaseResult, RestoreResult, Subscription } from '@/domain/models/subscription';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpSubscriptionApi(request: RequestFn): SubscriptionApi {
  return {
    getEntitlement: (_userId) => request<Entitlement>(`/api/v1/subscriptions/entitlement`),
    verifyPurchase: (_userId, receipt, platform, productId, transactionId) =>
      request<PurchaseResult>('/api/v1/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({ receipt, platform, productId, transactionId }),
      }),
    restorePurchases: (_userId, platform) => request<RestoreResult>('/api/v1/subscriptions/restore', { method: 'POST', body: JSON.stringify({ platform }) }),
    listSubscriptions: (_userId) => request<Subscription[]>('/api/v1/subscriptions'),
    listPurchases: (_userId) => request<Purchase[]>('/api/v1/subscriptions/purchases'),
  };
}
