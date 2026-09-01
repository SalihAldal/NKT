import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { aiBreaker } from '../common/circuit-breaker.js';
import { aiQueue } from '../workers/index.js';
import { hasEntitlement } from '../entitlements/entitlement.service.js';

const MAX_BATCH = 50;
const MAX_PER_ADMIN_HOUR = 5;

export async function aiRoutes(app: FastifyInstance) {
  app.post('/generate', { preHandler: authMiddleware }, async (req, reply) => {
    const premium = await hasEntitlement(req.userId!);
    if (!premium) {
      return reply.status(403).send(fail('ENTITLEMENT_REVOKED', 'Premium subscription required for AI generation', undefined, getRequestId(req)));
    }

    const body = z.object({
      categoryId: z.string().uuid(),
      count: z.number().int().min(1).max(MAX_BATCH),
      difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    }).parse(req.body);

    const recentBatches = await prisma.contentBatch.count({
      where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
    });
    if (recentBatches >= MAX_PER_ADMIN_HOUR) {
      return reply.status(429).send(fail('RATE_LIMIT', 'AI generation rate limit exceeded', undefined, getRequestId(req)));
    }

    const batch = await prisma.contentBatch.create({
      data: {
        categoryId: body.categoryId,
        requestedCount: body.count,
        status: 'queued',
      },
    });

    await aiQueue?.add('generate', { batchId: batch.id, categoryId: body.categoryId, count: body.count, difficulty: body.difficulty });
    return ok({ batchId: batch.id, status: 'queued' }, getRequestId(req));
  });
}

export async function processAiBatch(batchId: string, categoryId: string, count: number, difficulty: string) {
  return aiBreaker.execute(async () => {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw ERR.NOT_FOUND;

    const templates = [
      'En utandıran anın neydi?',
      'Bu kategoride en zor soru hangisi olurdu?',
      'Arkadaşların seni nasıl tanımlar?',
    ];

    for (let i = 0; i < Math.min(count, MAX_BATCH); i++) {
      const prompt = `${category.name}: ${templates[i % templates.length]}`;
      const existing = await prisma.gameContent.findFirst({ where: { prompt, categoryId } });
      if (existing) continue;

      await prisma.gameContent.create({
        data: {
          categoryId,
          prompt,
          type: 'QUESTION',
          difficulty: difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2,
          active: false,
          moderationStatus: 'REVIEW',
          premium: !category.isFree,
          aiGenerated: true,
        },
      });
    }

    await prisma.contentBatch.update({ where: { id: batchId }, data: { status: 'completed', generatedCount: count } });
  });
}
