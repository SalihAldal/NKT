import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';

export async function friendRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const userId = (req: { userId?: string }) => req.userId!;

  app.get('/', async (req, reply) => {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId(req) }, { receiverId: userId(req) }],
      },
    });
    const friendIds = friendships.map((f) => f.requesterId === userId(req) ? f.receiverId : f.requesterId);
    const profiles = await prisma.userProfile.findMany({ where: { userId: { in: friendIds } } });
    return ok(profiles, getRequestId(req));
  });

  app.get('/pending', async (req, reply) => {
    const pending = await prisma.friendship.findMany({
      where: { receiverId: userId(req), status: 'PENDING' },
    });
    const profiles = await prisma.userProfile.findMany({
      where: { userId: { in: pending.map((p) => p.requesterId) } },
    });
    return ok({ requests: pending, profiles }, getRequestId(req));
  });

  app.post('/request', async (req, reply) => {
    const { receiverId } = z.object({ receiverId: z.string().uuid() }).parse(req.body);
    if (receiverId === userId(req)) throw ERR.VALIDATION('Cannot friend yourself');

    const blocked = await prisma.friendBlock.findFirst({
      where: { OR: [
        { blockerId: receiverId, blockedUserId: userId(req) },
        { blockerId: userId(req), blockedUserId: receiverId },
      ]},
    });
    if (blocked) throw ERR.FORBIDDEN;

    const existing = await prisma.friendship.findFirst({
      where: { OR: [
        { requesterId: userId(req), receiverId },
        { requesterId: receiverId, receiverId: userId(req) },
      ]},
    });
    if (existing) throw ERR.CONFLICT;

    const friendship = await prisma.friendship.create({
      data: { requesterId: userId(req), receiverId, status: 'PENDING' },
    });
    return ok(friendship, getRequestId(req));
  });

  app.post('/accept', async (req, reply) => {
    const { friendshipId } = z.object({ friendshipId: z.string().uuid() }).parse(req.body);
    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.receiverId !== userId(req)) throw ERR.FORBIDDEN;
    const updated = await prisma.friendship.update({ where: { id: friendshipId }, data: { status: 'ACCEPTED' } });
    return ok(updated, getRequestId(req));
  });

  app.post('/block', async (req, reply) => {
    const { blockedUserId } = z.object({ blockedUserId: z.string().uuid() }).parse(req.body);
    await prisma.friendBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: userId(req), blockedUserId } },
      create: { blockerId: userId(req), blockedUserId },
      update: {},
    });
    await prisma.friendship.deleteMany({
      where: { OR: [
        { requesterId: userId(req), receiverId: blockedUserId },
        { requesterId: blockedUserId, receiverId: userId(req) },
      ]},
    });
    return ok({ blocked: true }, getRequestId(req));
  });

  app.post('/unblock', async (req, reply) => {
    const { blockedUserId } = z.object({ blockedUserId: z.string().uuid() }).parse(req.body);
    await prisma.friendBlock.deleteMany({ where: { blockerId: userId(req), blockedUserId } });
    return ok({ unblocked: true }, getRequestId(req));
  });

  app.get('/search', async (req, reply) => {
    const { q } = z.object({ q: z.string().min(2) }).parse(req.query);
    const profiles = await prisma.userProfile.findMany({
      where: {
        discoverable: true,
        OR: [
          { username: { contains: q.toLowerCase() } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { userId: userId(req) },
      },
      take: 20,
    });
    return ok(profiles, getRequestId(req));
  });
}
