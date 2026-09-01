import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../common/middleware.js';
import { AppError, ok, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { isAdult18 } from '../auth/identity.js';

export async function contentRoutes(app: FastifyInstance) {
  app.get('/categories', { preHandler: optionalAuth }, async (req, reply) => {
    const canSee18 = Boolean(req.user?.birthDate && isAdult18(req.user.birthDate));
    const categories = await prisma.category.findMany({
      where: { isActive: true, ...(canSee18 ? {} : { ageRating: { not: '18+' } }) },
      orderBy: { order: 'asc' },
    });
    return ok(categories, getRequestId(req));
  });

  app.get('/categories/:id', { preHandler: optionalAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const category = await prisma.category.findUnique({ where: { id } });
    if (category?.ageRating === '18+' && (!req.user?.birthDate || !isAdult18(req.user.birthDate))) {
      throw new AppError('AGE_RESTRICTED', '18+ content requires adult account', 403);
    }
    return ok(category, getRequestId(req));
  });

  app.get('/', { preHandler: authMiddleware }, async (req, reply) => {
    const query = z.object({
      categoryId: z.string().optional(),
      page: z.coerce.number().default(1),
      pageSize: z.coerce.number().max(100).default(50),
      moderationStatus: z.string().optional(),
    }).parse(req.query);

    const canSee18 = Boolean(req.user?.birthDate && isAdult18(req.user.birthDate));
    const where = {
      categoryId: query.categoryId,
      moderationStatus: query.moderationStatus as never,
      active: true,
      ...(canSee18 ? {} : { ageRating: { not: '18+' } }),
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
