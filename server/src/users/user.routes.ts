import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { revokeAllSessions } from '../auth/auth.service.js';
import { calculateAgeYears, normalizeUsername } from '../auth/identity.js';

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { profile: true, entitlement: true, notificationPrefs: true },
    });
    if (!user?.profile) throw ERR.NOT_FOUND;
    return ok({
      user: {
        id: user.id,
        accountType: user.accountType,
        isPremium: user.isPremium,
        status: user.status,
        birthDate: user.birthDate?.toISOString().slice(0, 10),
        ageYears: user.birthDate ? calculateAgeYears(user.birthDate) : null,
      },
      profile: user.profile,
      entitlement: user.entitlement,
      notificationPrefs: user.notificationPrefs,
    }, getRequestId(req));
  });

  app.patch('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      displayName: z.string().min(1).max(50).optional(),
      bio: z.string().max(160).optional(),
      avatarUrl: z.string().url().optional(),
      username: z.string().optional(),
      birthDate: z.string().optional(),
    }).strict().parse(req.body);

    if (body.username !== undefined || body.birthDate !== undefined) {
      return reply.status(403).send(fail('PROFILE_LOCKED', 'Username and birthDate cannot be changed', undefined, getRequestId(req)));
    }

    const profile = await prisma.userProfile.update({
      where: { userId: req.userId! },
      data: {
        displayName: body.displayName,
        bio: body.bio,
        avatarUrl: body.avatarUrl,
      },
    });
    return ok(profile, getRequestId(req));
  });

  app.get('/username-available', async (req: FastifyRequest, reply: FastifyReply) => {
    const { username } = z.object({ username: z.string() }).parse(req.query);
    const normalized = normalizeUsername(username);
    const taken = await prisma.userProfile.findFirst({ where: { usernameNormalized: normalized } });
    return ok({ available: !taken }, getRequestId(req));
  });

  app.delete('/me', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      await tx.user.update({ where: { id: req.userId! }, data: { status: 'DELETED', deletedAt: new Date() } });
      await tx.userProfile.update({
        where: { userId: req.userId! },
        data: {
          displayName: 'Deleted User',
          username: `deleted_${req.userId!.slice(0, 8)}`,
          usernameNormalized: `deleted_${req.userId!.slice(0, 8)}`,
        },
      });
    });
    await revokeAllSessions(req.userId!);
    return ok({ deleted: true }, getRequestId(req));
  });
}
