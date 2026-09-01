import type { FastifyRequest } from 'fastify';
import { ERR } from '../common/response.js';

const ROLE_HIERARCHY: Record<string, number> = {
  SUPPORT: 1,
  ANALYST: 2,
  MODERATOR: 3,
  CONTENT_MANAGER: 4,
  ADMIN: 5,
  SUPER_ADMIN: 6,
};

export function requireAdminRole(admin: { role: string }, minRole: keyof typeof ROLE_HIERARCHY) {
  const current = ROLE_HIERARCHY[admin.role] ?? 0;
  const required = ROLE_HIERARCHY[minRole] ?? 99;
  if (current < required) throw ERR.FORBIDDEN;
}

export async function adminAuth(req: FastifyRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ERR.UNAUTHORIZED;
  const token = header.slice(7);
  const { prisma } = await import('../database/prisma.js');
  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date() || !session.admin.isActive) throw ERR.UNAUTHORIZED;
  return session.admin;
}
