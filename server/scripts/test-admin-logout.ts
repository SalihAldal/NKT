import { buildApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import bcrypt from 'bcryptjs';

const email = 'logout-test@local.test';
const pass = 'TestPass123!';

const app = await buildApp();
await app.ready();

await prisma.adminUser.upsert({
  where: { email },
  create: { email, displayName: 'T', passwordHash: await bcrypt.hash(pass, 12), role: 'SUPER_ADMIN' },
  update: {},
});

const login = await app.inject({
  method: 'POST',
  url: '/api/v1/admin/auth/login',
  payload: { email, password: pass },
});
console.log('login', login.statusCode, login.body);

const token = (JSON.parse(login.body) as { data: { token: string } }).data.token;
const logout = await app.inject({
  method: 'POST',
  url: '/api/v1/admin/auth/logout',
  headers: { authorization: `Bearer ${token}` },
});
console.log('logout', logout.statusCode, logout.body);

await app.close();
await prisma.$disconnect();
