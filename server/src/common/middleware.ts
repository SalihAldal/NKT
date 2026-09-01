import type { FastifyRequest, FastifyReply } from 'fastify';
import { getUserFromToken } from '../auth/auth.service.js';
import { ERR, sendError, getRequestId } from '../common/response.js';
import type { AppError } from '../common/response.js';
import { isAdult18 } from '../auth/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    user?: Awaited<ReturnType<typeof getUserFromToken>>['user'];
    profile?: Awaited<ReturnType<typeof getUserFromToken>>['profile'];
  }
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendError(reply, ERR.UNAUTHORIZED, getRequestId(req));
  }
  try {
    const token = header.slice(7);
    const result = await getUserFromToken(token);
    req.userId = result.userId;
    req.user = result.user;
    req.profile = result.profile;
  } catch (err) {
    const appErr = err as AppError;
    return sendError(reply, appErr.statusCode ? appErr : ERR.UNAUTHORIZED, getRequestId(req));
  }
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  try {
    const result = await getUserFromToken(header.slice(7));
    req.userId = result.userId;
    req.user = result.user;
    req.profile = result.profile;
  } catch { /* optional */ }
}

export async function requireAge18(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.birthDate || !isAdult18(req.user.birthDate)) {
    return sendError(reply, new (await import('../common/response.js')).AppError('AGE_RESTRICTED', '18+ content requires age verification', 403), getRequestId(req));
  }
}
