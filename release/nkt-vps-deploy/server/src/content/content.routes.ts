import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';

export async function contentRoutes(app: FastifyInstance) {
  app.get('/categories', async (req, reply) => {
    const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
    return ok(categories, getRequestId(req));
  });

  app.get('/categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const category = await prisma.category.findUnique({ where: { id } });
    return ok(category, getRequestId(req));
  });

  app.get('/', { preHandler: authMiddleware }, async (req, reply) => {
    const query = z.object({
      categoryId: z.string().optional(),
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().max(100).default(50),
      moderationStatus: z.string().optional(),
    }).parse(req.query);

    const where = {
      categoryId: query.categoryId,
      moderationStatus: query.moderationStatus as never,
      active: true,
    };
    const [items, total] = await Promise.all([
      prisma.gameContent.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, categoryId: true, type: true, difficulty: true, prompt: true, premium: true, ageRating: true },
      }),
      prisma.gameContent.count({ where }),
    ]);
    return ok({ items, total, page: query.page, pageSize: query.pageSize }, getRequestId(req));
  });
}
