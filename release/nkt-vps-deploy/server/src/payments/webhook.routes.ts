import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { ok, fail, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { config } from '../config/index.js';
import { resolvePlanDays } from '../entitlements/product-catalog.js';
import {
  expireEntitlement,
  grantPremium,
  processRefund,
  revokeEntitlement,
  setGracePeriod,
} from '../entitlements/entitlement.service.js';
import { shouldApplyWebhookEvent } from '../entitlements/event-ordering.js';
import { logPaymentAudit } from '../entitlements/payment-audit.service.js';

function verifyWebhookSecret(req: FastifyRequest, provider: 'apple' | 'google'): boolean {
  if (!config.isProduction) return true;
  const secret = provider === 'apple' ? config.APPLE_WEBHOOK_SECRET : config.GOOGLE_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers['x-webhook-secret'] as string | undefined;
  if (!header) return false;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const appleEventSchema = z.object({
  notificationUUID: z.string().optional(),
  notificationType: z.string().optional(),
  transactionId: z.string().optional(),
  appAccountToken: z.string().optional(),
  productId: z.string().optional(),
  expiresDate: z.union([z.string(), z.number()]).optional(),
  eventTimestamp: z.union([z.string(), z.number()]).optional(),
});

const googleEventSchema = z.object({
  messageId: z.string(),
  subscriptionNotification: z.object({
    notificationType: z.number().optional(),
    purchaseToken: z.string().optional(),
    subscriptionId: z.string().optional(),
  }).optional(),
  userId: z.string().uuid().optional(),
  eventTimestamp: z.union([z.string(), z.number()]).optional(),
});

function parseEventTime(value: string | number | undefined): Date {
  if (value === undefined) return new Date();
  if (typeof value === 'number') return new Date(value);
  const n = Number(value);
  if (!Number.isNaN(n) && n > 1e12) return new Date(n);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function recordPaymentEvent(provider: string, eventId: string, eventType: string, body: unknown) {
  const payloadHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const existing = await prisma.paymentEvent.findUnique({ where: { eventId } });
  if (existing) return { duplicate: true as const, event: existing };

  const event = await prisma.paymentEvent.create({
    data: { provider, eventId, eventType, payloadHash },
  });
  return { duplicate: false as const, event };
}

async function processAppleEvent(body: z.infer<typeof appleEventSchema>) {
  const userId = body.appAccountToken;
  if (!userId || !z.string().uuid().safeParse(userId).success) return;

  const eventType = (body.notificationType ?? 'unknown').toUpperCase();
  const eventTime = parseEventTime(body.eventTimestamp);
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!shouldApplyWebhookEvent(subscription?.updatedAt ?? null, eventTime)) {
    logPaymentAudit({ action: 'webhook.skipped', userId, eventId: body.notificationUUID, reason: 'stale_event' });
    return;
  }

  const expiresAt = body.expiresDate
    ? parseEventTime(body.expiresDate)
    : new Date(Date.now() + resolvePlanDays(body.productId ?? 'monthly') * 86400000);

  switch (eventType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'DID_RECOVER':
      await grantPremium({
        userId,
        source: 'apple',
        expiresAt,
        provider: 'apple',
        productId: body.productId ?? 'com.nkt.app.premium.monthly',
        subscriptionStatus: 'ACTIVE',
      });
      break;
    case 'DID_FAIL_TO_RENEW':
    case 'GRACE_PERIOD':
      await setGracePeriod(userId, expiresAt, 'apple');
      break;
    case 'EXPIRED':
      await expireEntitlement(userId, 'apple_expired');
      break;
    case 'REVOKE':
    case 'REFUND':
    case 'REFUND_DECLINED':
      if (body.transactionId) await processRefund(userId, body.transactionId);
      else await revokeEntitlement(userId, eventType);
      break;
    default:
      logPaymentAudit({ action: 'webhook.skipped', userId, reason: `unhandled:${eventType}` });
  }
}

async function processGoogleEvent(body: z.infer<typeof googleEventSchema>) {
  const userId = body.userId;
  if (!userId) return;

  const notificationType = body.subscriptionNotification?.notificationType ?? 0;
  const eventTime = parseEventTime(body.eventTimestamp);
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!shouldApplyWebhookEvent(subscription?.updatedAt ?? null, eventTime)) {
    logPaymentAudit({ action: 'webhook.skipped', userId, eventId: body.messageId, reason: 'stale_event' });
    return;
  }

  const productId = body.subscriptionNotification?.subscriptionId ?? 'nkt_premium_monthly';
  const expiresAt = new Date(Date.now() + resolvePlanDays(productId) * 86400000);

  // Google RTDN notification types (simplified)
  switch (notificationType) {
    case 1: // RECOVERED
    case 2: // RENEWED
    case 4: // PURCHASED
      await grantPremium({ userId, source: 'android', expiresAt, provider: 'android', productId, subscriptionStatus: 'ACTIVE' });
      break;
    case 3: // CANCELED — keep active until expiry (provider rule)
      logPaymentAudit({ action: 'subscription.cancelled', userId, provider: 'android' });
      break;
    case 5: // ON_HOLD / grace
    case 6: // IN_GRACE_PERIOD
      await setGracePeriod(userId, expiresAt, 'android');
      break;
    case 12: // REVOKED
    case 13: // EXPIRED
      await expireEntitlement(userId, 'google_expired');
      break;
    default:
      logPaymentAudit({ action: 'webhook.skipped', userId, reason: `google_type:${notificationType}` });
  }
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/apple', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!verifyWebhookSecret(req, 'apple')) {
      return reply.status(401).send(fail('UNAUTHORIZED', 'Invalid webhook signature', undefined, getRequestId(req)));
    }

    const body = appleEventSchema.parse(req.body);
    const eventId = body.notificationUUID ?? body.transactionId ?? '';
    if (!eventId) return reply.status(400).send(fail('VALIDATION_ERROR', 'Missing event ID', undefined, getRequestId(req)));

    logPaymentAudit({ action: 'webhook.received', provider: 'apple', eventId, status: body.notificationType });

    const recorded = await recordPaymentEvent('apple', eventId, body.notificationType ?? 'unknown', body);
    if (recorded.duplicate) return ok({ status: 'duplicate' }, getRequestId(req));

    try {
      await processAppleEvent(body);
      await prisma.paymentEvent.update({ where: { id: recorded.event.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
      logPaymentAudit({ action: 'webhook.processed', provider: 'apple', eventId });
    } catch (err) {
      await prisma.paymentEvent.update({ where: { id: recorded.event.id }, data: { status: 'FAILED' } });
      throw err;
    }

    return ok({ status: 'processed' }, getRequestId(req));
  });

  app.post('/google', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!verifyWebhookSecret(req, 'google')) {
      return reply.status(401).send(fail('UNAUTHORIZED', 'Invalid webhook signature', undefined, getRequestId(req)));
    }

    const body = googleEventSchema.parse(req.body);
    const eventId = body.messageId;
    if (!eventId) return reply.status(400).send(fail('VALIDATION_ERROR', 'Missing event ID', undefined, getRequestId(req)));

    logPaymentAudit({ action: 'webhook.received', provider: 'google', eventId });

    const recorded = await recordPaymentEvent('google', eventId, String(body.subscriptionNotification?.notificationType ?? 'unknown'), body);
    if (recorded.duplicate) return ok({ status: 'duplicate' }, getRequestId(req));

    try {
      await processGoogleEvent(body);
      await prisma.paymentEvent.update({ where: { id: recorded.event.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
      logPaymentAudit({ action: 'webhook.processed', provider: 'google', eventId });
    } catch {
      await prisma.paymentEvent.update({ where: { id: recorded.event.id }, data: { status: 'FAILED' } });
    }

    return ok({ status: 'processed' }, getRequestId(req));
  });
}
