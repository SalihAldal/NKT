import { config } from '../../config/index.js';
import { paymentBreaker } from '../../common/circuit-breaker.js';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '@prisma/client';
import { isAllowedProductId, resolvePlanDays } from '../../entitlements/product-catalog.js';
import {
  ENTITLEMENT_STATUS,
  getEffectiveEntitlement,
  grantPremium,
} from '../../entitlements/entitlement.service.js';
import { logPaymentAudit } from '../../entitlements/payment-audit.service.js';

export interface VerifyPurchaseInput {
  userId: string;
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  receipt: string;
}

export interface VerifyPurchaseResult {
  valid: boolean;
  reason?: string;
  expiresAt?: Date;
  status?: string;
  alreadyProcessed?: boolean;
}

function mockReceiptAllowed(receipt: string, platform: 'ios' | 'android'): boolean {
  if (config.isProduction && !config.USE_MOCK_PAYMENT) return false;
  if (platform === 'ios') {
    return receipt.startsWith('mock-receipt-') || receipt.startsWith('apple-');
  }
  return receipt.startsWith('google-') || receipt.startsWith('mock-receipt-');
}

async function verifyWithApple(receipt: string): Promise<boolean> {
  if (!config.APPLE_SHARED_SECRET) {
    return mockReceiptAllowed(receipt, 'ios');
  }
  return paymentBreaker.execute(async () => {
    const endpoint = config.isProduction
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'receipt-data': receipt, password: config.APPLE_SHARED_SECRET }),
    });
    const json = await res.json() as { status: number };
    return json.status === 0;
  });
}

async function verifyWithGoogle(receipt: string, productId: string): Promise<boolean> {
  if (!config.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return mockReceiptAllowed(receipt, 'android');
  }
  return paymentBreaker.execute(async () => Boolean(receipt && productId));
}

export async function verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult> {
  if (!isAllowedProductId(input.productId)) {
    logPaymentAudit({ action: 'purchase.failed', userId: input.userId, reason: 'INVALID_PRODUCT', transactionId: input.transactionId });
    return { valid: false, reason: 'PURCHASE_INVALID' };
  }

  const existing = await prisma.purchase.findUnique({ where: { transactionId: input.transactionId } });
  if (existing) {
    if (existing.state === 'COMPLETED') {
      const entitlement = await getEffectiveEntitlement(input.userId);
      logPaymentAudit({ action: 'purchase.duplicate', userId: input.userId, transactionId: input.transactionId });
      return {
        valid: true,
        alreadyProcessed: true,
        expiresAt: entitlement.expiresAt ?? undefined,
        status: entitlement.status,
      };
    }
    if (existing.state === 'REFUNDED') {
      return { valid: false, reason: 'REFUND_PROCESSED' };
    }
  }

  const valid = input.platform === 'ios'
    ? await verifyWithApple(input.receipt)
    : await verifyWithGoogle(input.receipt, input.productId);

  if (!valid) {
    await prisma.purchase.upsert({
      where: { transactionId: input.transactionId },
      create: {
        userId: input.userId,
        productId: input.productId,
        platform: input.platform,
        transactionId: input.transactionId,
        state: 'FAILED',
      },
      update: { state: 'FAILED' },
    });
    logPaymentAudit({ action: 'purchase.failed', userId: input.userId, transactionId: input.transactionId, reason: 'VERIFICATION_FAILED' });
    return { valid: false, reason: 'VERIFICATION_FAILED' };
  }

  const days = resolvePlanDays(input.productId);
  const expiresAt = new Date(Date.now() + days * 86400000);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.purchase.upsert({
      where: { transactionId: input.transactionId },
      create: {
        userId: input.userId,
        productId: input.productId,
        platform: input.platform,
        transactionId: input.transactionId,
        state: 'COMPLETED',
      },
      update: { state: 'COMPLETED' },
    });
  });

  await grantPremium({
    userId: input.userId,
    source: input.platform,
    expiresAt,
    provider: input.platform,
    productId: input.productId,
    subscriptionStatus: 'ACTIVE',
  });

  logPaymentAudit({ action: 'purchase.verify', userId: input.userId, provider: input.platform, transactionId: input.transactionId, status: 'completed' });

  return { valid: true, expiresAt, status: ENTITLEMENT_STATUS.PREMIUM };
}

export async function getEntitlementForUser(userId: string) {
  const ent = await getEffectiveEntitlement(userId);
  return {
    userId: ent.userId,
    status: ent.status,
    source: ent.source,
    expiresAt: ent.expiresAt,
    updatedAt: ent.updatedAt,
    isPremium: ent.isPremium,
  };
}
