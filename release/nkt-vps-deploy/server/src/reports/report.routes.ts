import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { moderationQueue } from '../workers/index.js';

export async function reportRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const body = z.object({
      targetType: z.enum(['user', 'content', 'room', 'quiz']),
      targetId: z.string().min(1),
      reason: z.string().min(3).max(500),
      details: z.string().max(1000).optional(),
    }).parse(req.body);

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId!,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        description: body.details,
        status: 'OPEN',
        priority: 'MEDIUM',
      },
    });

    await moderationQueue?.add('report', { reportId: report.id });
    return ok(report, getRequestId(req));
  });

  app.get('/mine', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const reports = await prisma.report.findMany({ where: { reporterId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 50 });
    return ok(reports, getRequestId(req));
  });
}
