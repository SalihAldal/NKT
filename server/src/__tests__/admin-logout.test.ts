import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../database/prisma.js';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

describe('Admin logout', () => {
  let app: FastifyInstance;
  const email = `logout-${Date.now()}@test.local`;
  const password = 'TestPass123!';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma.adminUser.create({
      data: {
        email,
        displayName: 'Logout Test',
        passwordHash: await bcrypt.hash(password, 12),
        role: 'SUPER_ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.adminSession.deleteMany({ where: { admin: { email } } });
    await prisma.auditLog.deleteMany({ where: { admin: { email } } });
    await prisma.adminUser.deleteMany({ where: { email } });
    await app.close();
    await prisma.$disconnect();
  });

  it('login → logout → login again', async () => {
    const login1 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email, password },
    });
    expect(login1.statusCode).toBe(200);
    const token = (login1.json() as { data: { token: string } }).data.token;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);
    expect((logout.json() as { data: { loggedOut: boolean } }).data.loggedOut).toBe(true);

    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email, password },
    });
    expect(login2.statusCode).toBe(200);
  });
});
