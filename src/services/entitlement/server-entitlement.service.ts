import type { Entitlement } from '@/domain/models/user';
import type { SubscriptionPlan } from '@/domain/constants/enums';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { MONETIZATION_CONFIG, resolvePlanFromProductId } from '@config/monetization';
import { EntitlementPolicy } from './entitlement-policy';

export interface VerifyReceiptInput {
  userId: string;
  receipt: string;
  productId: string;
  platform: 'ios' | 'android';
  transactionId: string;
  originalTransactionId?: string;
  environment?: 'sandbox' | 'production';
}

export interface VerifyReceiptResult {
  valid: boolean;
  reason?: string;
  entitlement?: Entitlement;
}

const processedTransactions = new Set<string>();

/** Server-authoritative entitlement store */
class ServerEntitlementStore {
  private store = new Map<string, Entitlement>();

  get(userId: string): Entitlement | undefined {
    const e = this.store.get(userId);
    if (!e) return undefined;
    const effective = EntitlementPolicy.resolveEffectiveStatus(e);
    if (effective !== e.status) {
      const updated = { ...e, status: effective, updatedAt: new Date().toISOString() };
      this.store.set(userId, updated);
      return updated;
    }
    return e;
  }

  set(entitlement: Entitlement): Entitlement {
    const now = new Date().toISOString();
    const resolved = {
      ...entitlement,
      status: EntitlementPolicy.resolveEffectiveStatus(entitlement),
      updatedAt: now,
    };
    this.store.set(entitlement.userId, resolved);
    return resolved;
  }

  isTransactionProcessed(transactionId: string): boolean {
    return processedTransactions.has(transactionId);
  }

  markTransactionProcessed(transactionId: string): void {
    processedTransactions.add(transactionId);
  }

  _reset(): void {
    this.store.clear();
    processedTransactions.clear();
  }

  _setDirect(entitlement: Entitlement): Entitlement {
    const now = new Date().toISOString();
    const resolved = { ...entitlement, updatedAt: now };
    this.store.set(entitlement.userId, resolved);
    return resolved;
  }
}

const serverStore = new ServerEntitlementStore();

const computeExpiresAt = (plan: SubscriptionPlan | null): string => {
  const days = plan === 'weekly'
    ? MONETIZATION_CONFIG.products.weekly.durationDays
    : MONETIZATION_CONFIG.products.monthly.durationDays;
  return new Date(Date.now() + days * 86400000).toISOString();
};

export class ServerEntitlementService {
  /** Source of truth — always query this for authorization */
  getEntitlement(userId: string): Entitlement {
    const existing = serverStore.get(userId);
    if (existing) return existing;
    return {
      userId,
      status: ENTITLEMENT_STATUS.FREE,
      source: 'unknown',
      updatedAt: new Date().toISOString(),
    };
  }

  isPremium(userId: string): boolean {
    return EntitlementPolicy.hasPremiumAccess(this.getEntitlement(userId));
  }

  verifyAndGrant(input: VerifyReceiptInput): VerifyReceiptResult {
    if (serverStore.isTransactionProcessed(input.transactionId)) {
      const existing = this.getEntitlement(input.userId);
      return { valid: true, entitlement: existing };
    }

    if (!input.receipt || !input.productId) {
      return { valid: false, reason: 'Invalid receipt data' };
    }

    const plan = resolvePlanFromProductId(input.productId);
    if (!plan) {
      return { valid: false, reason: 'Unknown product' };
    }

    const now = new Date().toISOString();
    const entitlement: Entitlement = {
      userId: input.userId,
      status: ENTITLEMENT_STATUS.PREMIUM,
      plan,
      productId: input.productId,
      platform: input.platform,
      purchasedAt: now,
      expiresAt: computeExpiresAt(plan),
      verifiedAt: now,
      transactionId: input.transactionId,
      originalTransactionId: input.originalTransactionId ?? input.transactionId,
      environment: input.environment ?? 'sandbox',
      source: 'iap',
      updatedAt: now,
    };

    serverStore.markTransactionProcessed(input.transactionId);
    const saved = serverStore.set(entitlement);
    return { valid: true, entitlement: saved };
  }

  revoke(userId: string): Entitlement {
    const existing = this.getEntitlement(userId);
    return serverStore.set({
      ...existing,
      status: ENTITLEMENT_STATUS.REVOKED,
      updatedAt: new Date().toISOString(),
    });
  }

  expire(userId: string): Entitlement {
    const existing = this.getEntitlement(userId);
    return serverStore.set({
      ...existing,
      status: ENTITLEMENT_STATUS.EXPIRED,
      updatedAt: new Date().toISOString(),
    });
  }

  setGrace(userId: string): Entitlement {
    const existing = this.getEntitlement(userId);
    return serverStore.set({
      ...existing,
      status: ENTITLEMENT_STATUS.GRACE,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Reject client-asserted premium without server verification */
  rejectClientAssertion(userId: string, claimedStatus: string): boolean {
    if (claimedStatus === ENTITLEMENT_STATUS.PREMIUM || claimedStatus === ENTITLEMENT_STATUS.GRACE) {
      const server = this.getEntitlement(userId);
      return !EntitlementPolicy.hasPremiumAccess(server);
    }
    return false;
  }

  _reset(): void {
    serverStore._reset();
  }

  _setDirect(entitlement: Entitlement): Entitlement {
    return serverStore._setDirect(entitlement);
  }
}

export const serverEntitlementService = new ServerEntitlementService();
