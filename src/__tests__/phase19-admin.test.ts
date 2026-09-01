import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ADMIN = join(process.cwd(), 'admin');
const SERVER = join(process.cwd(), 'server');

describe('PHASE 19 — Admin production API integration', () => {
  it('1. Admin HTTP client exists', () => {
    expect(existsSync(join(ADMIN, 'src', 'services', 'http-client.ts'))).toBe(true);
    expect(existsSync(join(ADMIN, 'src', 'services', 'platform-api.ts'))).toBe(true);
    expect(existsSync(join(ADMIN, 'src', 'services', 'admin-api-http.ts'))).toBe(true);
  });

  it('2. Production blocks mock mode', () => {
    const config = readFileSync(join(ADMIN, 'src', 'config.ts'), 'utf-8');
    expect(config).toContain('VITE_ADMIN_USE_MOCK=true is not allowed');
    const vite = readFileSync(join(ADMIN, 'vite.config.ts'), 'utf-8');
    expect(vite).toContain('VITE_ADMIN_USE_MOCK=true');
  });

  it('3. Default mock is false', () => {
    const vite = readFileSync(join(ADMIN, 'vite.config.ts'), 'utf-8');
    expect(vite).toMatch(/VITE_ADMIN_USE_MOCK.*false/);
  });

  it('4. Admin routes cover core endpoints', () => {
    const routes = readFileSync(join(SERVER, 'src', 'admin', 'admin.routes.ts'), 'utf-8');
    for (const endpoint of [
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/dashboard',
      '/users',
      '/categories',
      '/content',
      '/rooms',
      '/games',
      '/reports',
      '/purchases',
      '/subscriptions',
      '/notifications',
      '/analytics',
      '/audit-logs',
      '/quizzes',
      '/social/stats',
      '/moderation/queue',
      '/system/health',
      '/system/feature-flags',
    ]) {
      expect(routes).toContain(endpoint);
    }
  });

  it('5. Admin service has DB-backed methods', () => {
    const service = readFileSync(join(SERVER, 'src', 'admin', 'admin.service.ts'), 'utf-8');
    for (const fn of [
      'getDashboardStats',
      'listUsers',
      'listContent',
      'listRooms',
      'listGames',
      'listReports',
      'listPurchases',
      'getAnalytics',
      'writeAuditLog',
    ]) {
      expect(service).toContain(fn);
    }
  });

  it('6. Pages use platform API not mock platform', () => {
    const users = readFileSync(join(ADMIN, 'src', 'pages', 'Users.tsx'), 'utf-8');
    expect(users).toContain('platformApi');
    expect(users).not.toContain('adminPlatform');
    const quizzes = readFileSync(join(ADMIN, 'src', 'pages', 'Quizzes.tsx'), 'utf-8');
    expect(quizzes).not.toContain('mockQuizzes');
  });

  it('7. RBAC enforced server-side', () => {
    const routes = readFileSync(join(SERVER, 'src', 'admin', 'admin.routes.ts'), 'utf-8');
    expect(routes).toContain('requireAdminRole');
    expect(routes).toContain('adminAuth');
  });

  it('8. Vite dev proxy configured', () => {
    const vite = readFileSync(join(ADMIN, 'vite.config.ts'), 'utf-8');
    expect(vite).toContain("proxy");
    expect(vite).toContain("'/api'");
  });
});
