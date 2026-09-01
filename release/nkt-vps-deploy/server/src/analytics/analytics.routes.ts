import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../common/middleware.js';
import { ok, getRequestId } from '../common/response.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.post('/events', { preHandler: optionalAuth }, async (req, reply) => {
    const body = z.object({
      events: z.array(z.object({
        name: z.string().max(100),
        params: z.record(z.unknown()).optional(),
        sessionId: z.string().optional(),
      })).max(50),
    }).parse(req.body);

    await prisma.analyticsEvent.createMany({
      data: body.events.map((e) => ({
        userId: req.userId,
        eventName: e.name,
        params: (e.params ?? {}) as Prisma.InputJsonValue,
        sessionId: e.sessionId,
      })),
    });
    return ok({ received: body.events.length }, getRequestId(req));
  });
}
