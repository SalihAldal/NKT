import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../database/prisma.js';
import { grantPremium } from '../entitlements/entitlement.service.js';

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function uniqueUsername(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function register(app: FastifyInstance, username: string, birthDate: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, password: 'TestPass123!', birthDate },
  });
  return res;
}

describe('PHASE 29 — Auth + Age Guards', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma.$connect();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('register/login/recovery with username contract works', async () => {
    const username = uniqueUsername('phase29');
    const reg = await register(app, username, '2000-01-01');
    expect(reg.statusCode).toBe(200);
    const regJson = reg.json() as { success: boolean; data: { recoveryCode?: string } };
    expect(regJson.success).toBe(true);
    expect(Boolean(regJson.data.recoveryCode)).toBe(true);

    const dup = await register(app, username.toUpperCase(), '2000-01-01');
    expect(dup.statusCode).toBe(409);

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username, password: 'WrongPass123!' },
    });
    expect(wrong.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: username.toUpperCase(), password: 'TestPass123!' },
    });
    expect(login.statusCode).toBe(200);
    const loginJson = login.json() as { data: { tokens: { accessToken: string; refreshToken: string } } };
    expect(loginJson.data.tokens.accessToken.length).toBeGreaterThan(20);

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: loginJson.data.tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);

    const recoveryCode = (reg.json() as { data: { recoveryCode: string } }).data.recoveryCode;
    const recover = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/recover',
      payload: { username, recoveryCode, newPassword: 'NewPass123!' },
    });
    expect(recover.statusCode).toBe(200);
    const newCode = (recover.json() as { data: { recoveryCode?: string } }).data.recoveryCode;
    expect(Boolean(newCode)).toBe(true);

    const oldPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username, password: 'TestPass123!' },
    });
    expect(oldPassword.statusCode).toBe(401);

    const newPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username, password: 'NewPass123!' },
    });
    expect(newPassword.statusCode).toBe(200);

    const invalidRecovery = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/recover',
      payload: { username, recoveryCode: 'NKT-AAAA-BBBB-CCCC', newPassword: 'Again12345!' },
    });
    expect(invalidRecovery.statusCode).toBe(401);
  });

  it('enforces 18+ category server-side and premium does not bypass', async () => {
    const category18 =
      (await prisma.category.findFirst({ where: { ageRating: '18+', isActive: true, isFree: true } })) ??
      (await prisma.category.create({
        data: {
          id: `cat_phase29_18_${Date.now()}`,
          slug: `phase29-18-${Date.now()}`,
          name: 'Phase29 18+',
          description: 'phase29',
          icon: 'lock',
          order: 999,
          isFree: true,
          minimumContentTarget: 1,
          ageRating: '18+',
          supportedContentTypes: ['QUESTION'],
        },
      }));

    const under18Reg = await register(app, uniqueUsername('u17'), '2010-01-01');
    const adult18Reg = await register(app, uniqueUsername('u18'), '2008-01-01');
    const adult19Reg = await register(app, uniqueUsername('u19'), '2007-01-01');
    expect(under18Reg.statusCode).toBe(200);
    expect(adult18Reg.statusCode).toBe(200);
    expect(adult19Reg.statusCode).toBe(200);

    const under18Token = (under18Reg.json() as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
    const adult18Token = (adult18Reg.json() as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
    const adult19Token = (adult19Reg.json() as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
    const under18UserId = (under18Reg.json() as { data: { user: { id: string } } }).data.user.id;

    const underList = await app.inject({
      method: 'GET',
      url: '/api/v1/content/categories',
      headers: authHeader(under18Token),
    });
    expect(underList.statusCode).toBe(200);
    const underItems = (underList.json() as { data: Array<{ id: string }> }).data;
    expect(underItems.some((c) => c.id === category18.id)).toBe(false);

    const adultList = await app.inject({
      method: 'GET',
      url: '/api/v1/content/categories',
      headers: authHeader(adult19Token),
    });
    expect(adultList.statusCode).toBe(200);
    const adultItems = (adultList.json() as { data: Array<{ id: string }> }).data;
    expect(adultItems.some((c) => c.id === category18.id)).toBe(true);

    const underCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(under18Token),
      payload: { hostDisplayName: 'under' },
    });
    expect(underCreate.statusCode).toBe(200);
    const underRoom = (underCreate.json() as { data: { room: { id: string }; player: { sessionToken: string } } }).data;

    const underSelect = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${underRoom.room.id}/category`,
      headers: authHeader(under18Token),
      payload: { sessionToken: underRoom.player.sessionToken, categoryId: category18.id },
    });
    expect(underSelect.statusCode).toBe(403);

    await grantPremium({
      userId: under18UserId,
      source: 'admin',
      expiresAt: new Date(Date.now() + 7 * 86400000),
      provider: 'admin',
      productId: 'nkt_premium_monthly',
    });
    const underPremiumCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(under18Token),
      payload: { hostDisplayName: 'under-premium' },
    });
    const underPremiumRoom = (underPremiumCreate.json() as { data: { room: { id: string }; player: { sessionToken: string } } }).data;
    const underPremiumSelect = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${underPremiumRoom.room.id}/category`,
      headers: authHeader(under18Token),
      payload: { sessionToken: underPremiumRoom.player.sessionToken, categoryId: category18.id },
    });
    expect(underPremiumSelect.statusCode).toBe(403);

    const adultCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms/create',
      headers: authHeader(adult18Token),
      payload: { hostDisplayName: 'adult' },
    });
    expect(adultCreate.statusCode).toBe(200);
    const adultRoom = (adultCreate.json() as { data: { room: { id: string }; player: { sessionToken: string } } }).data;
    const adultSelect = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${adultRoom.room.id}/category`,
      headers: authHeader(adult18Token),
      payload: { sessionToken: adultRoom.player.sessionToken, categoryId: category18.id },
    });
    expect(adultSelect.statusCode).toBe(200);
  });
});
