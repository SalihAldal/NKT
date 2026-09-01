import type {
  EntitlementStatus,
  PurchaseStatus,
  SubscriptionPlan,
} from '../constants/enums';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  productId: string;
  platform: 'ios' | 'android';
  status: PurchaseStatus;
  startedAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  receipt?: string;
}

export interface Purchase {
  id: string;
  userId: string;
  productId: string;
  platform: 'ios' | 'android';
  status: PurchaseStatus;
  amount?: number;
  currency?: string;
  purchasedAt: string;
  receipt?: string;
}

export interface PurchaseResult {
  success: boolean;
  status: PurchaseStatus;
  entitlement?: {
    status: EntitlementStatus;
    expiresAt?: string;
    productId?: string;
    verified: boolean;
  };
  error?: string;
}

export interface RestoreResult {
  restored: boolean;
  entitlement?: PurchaseResult['entitlement'];
}
