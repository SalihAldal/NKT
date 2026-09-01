import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { getEntitlementForUser, verifyPurchase } from '../providers/payment/verification.provider.js';
import { hasEntitlement } from '../entitlements/entitlement.service.js';
import { logPaymentAudit } from '../entitlements/payment-audit.service.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/entitlement', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const entitlement = await getEntitlementForUser(req.userId!);
    return ok({
      userId: req.userId,
      status: entitlement.status,
      source: entitlement.source ?? 'unknown',
      expiresAt: entitlement.expiresAt?.toISOString() ?? null,
      productId: null,
      verified: true,
      updatedAt: entitlement.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    }, getRequestId(req));
  });

  app.post('/verify', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      receipt: z.string().min(1),
      platform: z.enum(['ios', 'android']),
      productId: z.string().min(1),
      transactionId: z.string().min(1),
    }).parse(req.body);

    const result = await verifyPurchase({
      userId: req.userId!,
      platform: body.platform,
      productId: body.productId,
      transactionId: body.transactionId,
      receipt: body.receipt,
    });

    if (!result.valid) {
      const code = result.reason ?? 'VERIFICATION_FAILED';
      const status = code === 'PURCHASE_INVALID' ? 422 : 400;
      return reply.status(status).send(fail(code, 'Purchase verification failed', undefined, getRequestId(req)));
    }

    if (result.alreadyProcessed) {
      return ok({ success: true, status: 'already_processed', entitlement: await getEntitlementForUser(req.userId!) }, getRequestId(req));
    }

    const entitlement = await getEntitlementForUser(req.userId!);
    return ok({
      success: true,
      status: 'success',
      entitlement: {
        userId: req.userId,
        status: entitlement.status,
        expiresAt: entitlement.expiresAt?.toISOString() ?? null,
        productId: body.productId,
        verified: true,
        updatedAt: new Date().toISOString(),
      },
    }, getRequestId(req));
  });

  app.post('/restore', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      platform: z.enum(['ios', 'android']),
      receipts: z.array(z.object({
        receipt: z.string(),
        productId: z.string(),
        transactionId: z.string(),
      })).optional(),
    }).parse(req.body);

    if (body.receipts?.length) {
      for (const r of body.receipts) {
        await verifyPurchase({
          userId: req.userId!,
          platform: body.platform,
          productId: r.productId,
          transactionId: r.transactionId,
          receipt: r.receipt,
        }).catch(() => undefined);
      }
    }

    const entitlement = await getEntitlementForUser(req.userId!);
    const restored = entitlement.status === 'premium' || entitlement.status === 'grace';
    logPaymentAudit({ action: 'restore', userId: req.userId!, status: restored ? 'restored' : 'not_found' });
    return ok({
      restored,
      entitlement: restored ? {
        userId: req.userId,
        status: entitlement.status,
        expiresAt: entitlement.expiresAt?.toISOString() ?? null,
        productId: null,
        verified: true,
        updatedAt: new Date().toISOString(),
      } : undefined,
    }, getRequestId(req));
  });

  app.get('/', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const subs = await prisma.subscription.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'desc' } });
    return ok(subs, getRequestId(req));
  });

  app.get('/purchases', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const purchases = await prisma.purchase.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'desc' } });
    return ok(purchases, getRequestId(req));
  });
}
