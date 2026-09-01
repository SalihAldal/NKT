import { prisma } from '../database/prisma.js';
import type { Prisma, SubscriptionStatus } from '@prisma/client';
import { MONETIZATION_GRACE_DAYS } from './constants.js';
import { logPaymentAudit } from './payment-audit.service.js';
import { shouldApplyWebhookEvent } from './event-ordering.js';

export const ENTITLEMENT_STATUS = {
  FREE: 'free',
  PREMIUM: 'premium',
  GRACE: 'grace',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  PENDING: 'pending',
} as const;

export type EntitlementStatusValue = (typeof ENTITLEMENT_STATUS)[keyof typeof ENTITLEMENT_STATUS];

export interface EffectiveEntitlement {
  userId: string;
  status: EntitlementStatusValue;
  source: string;
  expiresAt: Date | null;
  updatedAt: Date;
  isPremium: boolean;
}

function resolveEffectiveStatus(
  status: string,
  expiresAt: Date | null,
  now = new Date(),
): EntitlementStatusValue {
  if (status === ENTITLEMENT_STATUS.REVOKED) return ENTITLEMENT_STATUS.REVOKED;
  if (status === ENTITLEMENT_STATUS.PENDING) return ENTITLEMENT_STATUS.PENDING;
  if (status === ENTITLEMENT_STATUS.FREE) return ENTITLEMENT_STATUS.FREE;

  if (!expiresAt) {
    if (status === ENTITLEMENT_STATUS.PREMIUM || status === ENTITLEMENT_STATUS.GRACE) return status as EntitlementStatusValue;
    return ENTITLEMENT_STATUS.FREE;
  }

  if (expiresAt > now) {
    return status === ENTITLEMENT_STATUS.GRACE ? ENTITLEMENT_STATUS.GRACE : ENTITLEMENT_STATUS.PREMIUM;
  }

  const graceEnd = new Date(expiresAt.getTime() + MONETIZATION_GRACE_DAYS * 86400000);
  if (now <= graceEnd) return ENTITLEMENT_STATUS.GRACE;
  return ENTITLEMENT_STATUS.EXPIRED;
}

function hasPremiumAccess(status: EntitlementStatusValue): boolean {
  return status === ENTITLEMENT_STATUS.PREMIUM || status === ENTITLEMENT_STATUS.GRACE;
}

async function syncUserPremiumFlag(tx: Prisma.TransactionClient, userId: string, isPremium: boolean) {
  await tx.user.update({ where: { id: userId }, data: { isPremium } });
}

export async function getEffectiveEntitlement(userId: string): Promise<EffectiveEntitlement> {
  const row = await prisma.entitlement.findUnique({ where: { userId } });
  if (!row) {
    return {
      userId,
      status: ENTITLEMENT_STATUS.FREE,
      source: 'unknown',
      expiresAt: null,
      updatedAt: new Date(),
      isPremium: false,
    };
  }

  const effective = resolveEffectiveStatus(row.status, row.expiresAt);
  const isPremium = hasPremiumAccess(effective);

  if (effective !== row.status || isPremium !== (await prisma.user.findUnique({ where: { id: userId }, select: { isPremium: true } }))?.isPremium) {
    await prisma.$transaction(async (tx) => {
      if (effective !== row.status) {
        await tx.entitlement.update({ where: { userId }, data: { status: effective } });
      }
      await syncUserPremiumFlag(tx, userId, isPremium);
    });
    logPaymentAudit({ action: 'entitlement.expire', userId, status: effective });
  }

  return {
    userId,
    status: effective,
    source: row.source,
    expiresAt: row.expiresAt,
    updatedAt: row.updatedAt,
    isPremium,
  };
}

export async function hasEntitlement(userId: string): Promise<boolean> {
  const ent = await getEffectiveEntitlement(userId);
  return ent.isPremium;
}

/** Room host premium check — same as hasEntitlement for current product rules. */
export async function isHostPremium(userId: string): Promise<boolean> {
  return hasEntitlement(userId);
}

export async function grantPremium(params: {
  userId: string;
  source: string;
  expiresAt: Date;
  provider: string;
  productId: string;
  subscriptionStatus?: SubscriptionStatus;
}) {
  const status = params.subscriptionStatus === 'GRACE'
    ? ENTITLEMENT_STATUS.GRACE
    : ENTITLEMENT_STATUS.PREMIUM;

  await prisma.$transaction(async (tx) => {
    await tx.entitlement.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        status,
        source: params.source,
        expiresAt: params.expiresAt,
      },
      update: {
        status,
        source: params.source,
        expiresAt: params.expiresAt,
      },
    });
    await syncUserPremiumFlag(tx, params.userId, true);

    const existing = await tx.subscription.findFirst({
      where: { userId: params.userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          status: params.subscriptionStatus ?? 'ACTIVE',
          expiresAt: params.expiresAt,
          productId: params.productId,
          provider: params.provider,
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          userId: params.userId,
          productId: params.productId,
          provider: params.provider,
          status: params.subscriptionStatus ?? 'ACTIVE',
          expiresAt: params.expiresAt,
        },
      });
    }
  });

  logPaymentAudit({
    action: 'entitlement.grant',
    userId: params.userId,
    provider: params.provider,
    status,
  });
}

export async function setGracePeriod(userId: string, expiresAt: Date, provider: string) {
  await prisma.$transaction(async (tx) => {
    await tx.entitlement.update({
      where: { userId },
      data: { status: ENTITLEMENT_STATUS.GRACE, expiresAt },
    });
    await tx.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'GRACE' },
    });
    await syncUserPremiumFlag(tx, userId, true);
  });
  logPaymentAudit({ action: 'subscription.grace', userId, provider, status: 'grace' });
}

export async function expireEntitlement(userId: string, reason = 'expired') {
  await prisma.$transaction(async (tx) => {
    await tx.entitlement.updateMany({
      where: { userId },
      data: { status: ENTITLEMENT_STATUS.EXPIRED },
    });
    await tx.subscription.updateMany({
      where: { userId, status: { in: ['ACTIVE', 'GRACE', 'PENDING'] } },
      data: { status: 'EXPIRED' },
    });
    await syncUserPremiumFlag(tx, userId, false);
  });
  logPaymentAudit({ action: 'entitlement.expire', userId, reason, status: 'expired' });
}

export async function revokeEntitlement(userId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.entitlement.updateMany({
      where: { userId },
      data: { status: ENTITLEMENT_STATUS.REVOKED },
    });
    await tx.subscription.updateMany({
      where: { userId, status: { in: ['ACTIVE', 'GRACE', 'PENDING'] } },
      data: { status: 'REVOKED' },
    });
    await syncUserPremiumFlag(tx, userId, false);
  });
  logPaymentAudit({ action: 'entitlement.revoke', userId, reason, status: 'revoked' });
}

export async function processRefund(userId: string, transactionId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.purchase.updateMany({
      where: { transactionId },
      data: { state: 'REFUNDED' },
    });
    await tx.entitlement.updateMany({
      where: { userId },
      data: { status: ENTITLEMENT_STATUS.REVOKED },
    });
    await tx.subscription.updateMany({
      where: { userId, status: { in: ['ACTIVE', 'GRACE', 'PENDING'] } },
      data: { status: 'REVOKED' },
    });
    await syncUserPremiumFlag(tx, userId, false);
  });
  logPaymentAudit({ action: 'subscription.refunded', userId, transactionId, status: 'refunded' });
}
