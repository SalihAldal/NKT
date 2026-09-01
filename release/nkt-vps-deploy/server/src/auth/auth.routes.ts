import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as authService from '../auth/auth.service.js';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId, ERR } from '../common/response.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/),
});

function mapSession(s: Awaited<ReturnType<typeof authService.login>>) {
  return {
    user: { id: s.user.id, accountType: s.user.accountType, isPremium: s.user.isPremium, createdAt: s.user.createdAt.toISOString() },
    profile: { userId: s.profile.userId, displayName: s.profile.displayName, username: s.profile.username, bio: s.profile.bio, avatarUrl: s.profile.avatarUrl },
    entitlement: { userId: s.entitlement.userId, status: s.entitlement.status, expiresAt: s.entitlement.expiresAt?.toISOString() },
    tokens: s.tokens,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send(fail('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten(), getRequestId(req)));
    const session = await authService.login(parsed.data.email, parsed.data.password, req.ip);
    return ok(mapSession(session), getRequestId(req));
  });

  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send(fail('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten(), getRequestId(req)));
    const session = await authService.register(parsed.data, req.ip);
    return ok(mapSession(session), getRequestId(req));
  });

  app.post('/guest', async (req, reply) => {
    const body = req.body as { displayName?: string } | undefined;
    const session = await authService.createGuestSession(body?.displayName);
    return ok(mapSession(session), getRequestId(req));
  });

  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) return reply.status(422).send(fail('VALIDATION_ERROR', 'refreshToken required', undefined, getRequestId(req)));
    const tokens = await authService.refreshTokens(refreshToken);
    return ok(tokens, getRequestId(req));
  });

  app.post('/logout', { preHandler: authMiddleware }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) await authService.logout(refreshToken);
    return ok({ loggedOut: true }, getRequestId(req));
  });

  app.get('/session', { preHandler: authMiddleware }, async (req, reply) => {
    if (!req.userId) throw ERR.UNAUTHORIZED;
    const { prisma } = await import('../database/prisma.js');
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { profile: true, entitlement: true } });
    if (!user?.profile) throw ERR.NOT_FOUND;
    return ok({
      user: { id: user.id, accountType: user.accountType, isPremium: user.isPremium },
      profile: user.profile,
      entitlement: user.entitlement,
    }, getRequestId(req));
  });
}
