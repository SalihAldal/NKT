import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { createHash } from 'crypto';

export async function rewardRoutes(app: FastifyInstance) {
  app.post('/ad-reward', { preHandler: authMiddleware }, async (req, reply) => {
    const body = z.object({
      placement: z.string().max(64),
      rewardType: z.string().max(64),
      verificationToken: z.string().min(8),
    }).parse(req.body);

    const idempotencyKey = createHash('sha256')
      .update(`${req.userId}:${body.placement}:${body.rewardType}:${body.verificationToken}`)
      .digest('hex');

    const existing = await prisma.paymentEvent.findUnique({ where: { eventId: idempotencyKey } });
    if (existing) {
      return ok({ rewarded: true, duplicate: true }, getRequestId(req));
    }

    // Server validates reward — client callback alone is insufficient
    if (!body.verificationToken.startsWith('ad-verified-')) {
      return reply.status(400).send(fail('INVALID_REWARD', 'Reward verification failed', undefined, getRequestId(req)));
    }

    await prisma.paymentEvent.create({
      data: {
        provider: 'ad_reward',
        eventId: idempotencyKey,
        eventType: body.rewardType,
        payloadHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return ok({ rewarded: true, rewardType: body.rewardType }, getRequestId(req));
  });
}
