import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { revokeAllSessions } from '../auth/auth.service.js';

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { profile: true, entitlement: true, notificationPrefs: true },
    });
    if (!user?.profile) throw ERR.NOT_FOUND;
    return ok({
      user: { id: user.id, accountType: user.accountType, isPremium: user.isPremium, status: user.status },
      profile: user.profile,
      entitlement: user.entitlement,
      notificationPrefs: user.notificationPrefs,
    }, getRequestId(req));
  });

  app.patch('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      displayName: z.string().min(1).max(50).optional(),
      username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
      bio: z.string().max(160).optional(),
      avatarUrl: z.string().url().optional(),
    }).parse(req.body);

    if (body.username) {
      const taken = await prisma.userProfile.findFirst({
        where: { username: body.username.toLowerCase(), NOT: { userId: req.userId! } },
      });
      if (taken) return reply.status(409).send(fail('USERNAME_TAKEN', 'Username taken', undefined, getRequestId(req)));
    }

    const profile = await prisma.userProfile.update({
      where: { userId: req.userId! },
      data: {
        displayName: body.displayName,
        username: body.username?.toLowerCase(),
        bio: body.bio,
        avatarUrl: body.avatarUrl,
      },
    });
    return ok(profile, getRequestId(req));
  });

  app.get('/username-available', async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = z.object({ username: z.string() }).parse(req.query);
    const taken = await prisma.userProfile.findUnique({ where: { username: username.toLowerCase() } });
    return ok({ available: !taken }, getRequestId(req));
  });

  app.delete('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      await tx.user.update({ where: { id: req.userId! }, data: { status: 'DELETED', deletedAt: new Date() } });
      await tx.userProfile.update({ where: { userId: req.userId! }, data: { displayName: 'Deleted User', username: `deleted_${req.userId!.slice(0, 8)}` } });
    });
    await revokeAllSessions(req.userId!);
    return ok({ deleted: true }, getRequestId(req));
  });
}
