import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const routesPath = join(process.cwd(), 'src', 'admin', 'admin.routes.ts');

describe('PHASE 19 — Admin routes structure', () => {
  const routes = readFileSync(routesPath, 'utf-8');

  it('login endpoint does not require prior auth', () => {
    expect(routes).toMatch(/app\.post\('\/auth\/login'/);
    const loginBlock = routes.split("app.post('/auth/login'")[1]?.split('app.post')[0] ?? '';
    expect(loginBlock).not.toContain('adminAuth(req)');
  });

  it('protected endpoints call adminAuth', () => {
    expect(routes).toContain("app.get('/users'");
    expect(routes).toContain('await adminAuth(req)');
  });

  it('mutations write audit logs', () => {
    expect(routes).toContain('writeAuditLog');
    expect(routes).toContain("action: 'user.suspend'");
    expect(routes).toContain("action: 'content.delete'");
  });
});
