import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd(), 'server');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');

describe('PHASE 18 — Database migrations', () => {
  it('1. Prisma schema exists', () => {
    expect(existsSync(join(ROOT, 'prisma', 'schema.prisma'))).toBe(true);
  });

  it('2. migration_lock.toml exists', () => {
    expect(existsSync(join(MIGRATIONS_DIR, 'migration_lock.toml'))).toBe(true);
    const lock = readFileSync(join(MIGRATIONS_DIR, 'migration_lock.toml'), 'utf-8');
    expect(lock).toContain('postgresql');
  });

  it('3. Initial migration exists', () => {
    const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => d !== 'migration_lock.toml');
    expect(dirs.length).toBeGreaterThanOrEqual(1);
    const init = dirs.find((d) => d.includes('init'));
    expect(init).toBeDefined();
    expect(existsSync(join(MIGRATIONS_DIR, init!, 'migration.sql'))).toBe(true);
  });

  it('4. Initial migration has no DROP TABLE', () => {
    const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => d !== 'migration_lock.toml');
    for (const dir of dirs) {
      const sql = readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf-8');
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    }
  });

  it('5. Initial migration creates core tables', () => {
    const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => d.includes('init'));
    const sql = readFileSync(join(MIGRATIONS_DIR, dirs[0]!, 'migration.sql'), 'utf-8');
    for (const table of ['users', 'rooms', 'games', 'categories', 'game_contents', 'purchases', 'subscriptions', 'audit_logs']) {
      expect(sql).toContain(`"${table}"`);
    }
  });

  it('6. package.json has production-safe commands', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:migrate:deploy']).toContain('migrate deploy');
    expect(pkg.scripts['db:validate']).toBeDefined();
    expect(pkg.scripts['db:reset']).toContain('dev-only');
  });

  it('7. seed blocked in production without flag', () => {
    const seed = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf-8');
    expect(seed).toContain('ALLOW_PRODUCTION_SEED');
    expect(seed).toContain("NODE_ENV === 'production'");
  });

  it('8. content import is separate from seed', () => {
    expect(existsSync(join(ROOT, 'prisma', 'import-content.ts'))).toBe(true);
    const seed = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf-8');
    expect(seed).not.toContain('content-dataset.json');
  });

  it('9. DATABASE.md documentation exists', () => {
    expect(existsSync(join(process.cwd(), 'docs', 'DATABASE.md'))).toBe(true);
  });

  it('10. deploy.sh runs backup before migration', () => {
    const deploy = readFileSync(join(process.cwd(), 'infra', 'scripts', 'deploy.sh'), 'utf-8');
    const backupIdx = deploy.indexOf('backup-db.sh');
    const migrateIdx = deploy.indexOf('migrate deploy');
    expect(backupIdx).toBeGreaterThan(-1);
    expect(migrateIdx).toBeGreaterThan(backupIdx);
  });
});
