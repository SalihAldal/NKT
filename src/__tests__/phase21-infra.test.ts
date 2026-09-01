import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const INFRA = join(ROOT, 'infra');

describe('PHASE 21 — VPS production infrastructure', () => {
  it('1. Production compose has no public DB/Redis ports', () => {
    const compose = readFileSync(join(INFRA, 'docker-compose.prod.yml'), 'utf-8');
    expect(compose).toContain('nkt-postgres');
    expect(compose).toContain('nkt-nginx');
    const postgresBlock = compose.match(/nkt-postgres:[\s\S]*?(?=\n  nkt-redis:)/)?.[0] ?? '';
    const redisBlock = compose.match(/nkt-redis:[\s\S]*?(?=\n  nkt-api:)/)?.[0] ?? '';
    expect(postgresBlock).not.toContain('ports:');
    expect(redisBlock).not.toContain('ports:');
  });

  it('2. SERVICE_ROLE separation in compose', () => {
    const compose = readFileSync(join(INFRA, 'docker-compose.prod.yml'), 'utf-8');
    expect(compose).toContain('SERVICE_ROLE: api');
    expect(compose).toContain('SERVICE_ROLE: realtime');
    expect(compose).toContain('SERVICE_ROLE: worker');
  });

  it('3. Deploy script: backup before migration', () => {
    const deploy = readFileSync(join(INFRA, 'scripts', 'deploy.sh'), 'utf-8');
    const backupIdx = deploy.indexOf('backup-db.sh');
    const migrateIdx = deploy.indexOf('migrate deploy');
    expect(backupIdx).toBeGreaterThan(-1);
    expect(migrateIdx).toBeGreaterThan(backupIdx);
  });

  it('4. Deploy uses safe env sourcing', () => {
    const deploy = readFileSync(join(INFRA, 'scripts', 'deploy.sh'), 'utf-8');
    expect(deploy).toContain('set -a');
    expect(deploy).toContain('source "$ENV_FILE"');
    expect(deploy).not.toContain('export $(grep');
  });

  it('5. HTTPS nginx templates exist', () => {
    expect(existsSync(join(INFRA, 'nginx', 'conf.d', 'api.ssl.conf.template'))).toBe(true);
    expect(existsSync(join(INFRA, 'nginx', 'conf.d', 'realtime.ssl.conf.template'))).toBe(true);
    expect(existsSync(join(INFRA, 'nginx', 'snippets', 'ssl-params.conf'))).toBe(true);
  });

  it('6. Realtime nginx has WebSocket headers', () => {
    const rt = readFileSync(join(INFRA, 'nginx', 'conf.d', 'realtime.conf.template'), 'utf-8');
    expect(rt).toContain('Upgrade');
    expect(rt).toContain('socket.io');
  });

  it('7. Production config validates VITE_API_URL path', () => {
    const check = readFileSync(join(INFRA, 'scripts', 'check-production-config.sh'), 'utf-8');
    expect(check).toContain('/api/v1');
    expect(check).toContain('USE_MOCK_PAYMENT');
  });

  it('8. Health endpoints live/ready exist', () => {
    const health = readFileSync(join(ROOT, 'server', 'src', 'health', 'health.routes.ts'), 'utf-8');
    expect(health).toContain('/health/live');
    expect(health).toContain('/health/ready');
  });

  it('9. Graceful shutdown with timeout', () => {
    const idx = readFileSync(join(ROOT, 'server', 'src', 'index.ts'), 'utf-8');
    expect(idx).toContain('SHUTDOWN_TIMEOUT_MS');
    expect(idx).toContain('closeRealtime');
  });

  it('10. Monitor and VPS audit scripts exist', () => {
    expect(existsSync(join(INFRA, 'scripts', 'monitor.sh'))).toBe(true);
    expect(existsSync(join(INFRA, 'scripts', 'vps-audit.sh'))).toBe(true);
  });

  it('11. Production env example has smoke URLs and SSL flag', () => {
    const env = readFileSync(join(INFRA, 'env', '.env.production.example'), 'utf-8');
    expect(env).toContain('SMOKE_API_URL');
    expect(env).toContain('ENABLE_SSL');
    expect(env).toContain('/api/v1');
  });

  it('12. Secrets gitignored', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.env.production');
    expect(gitignore).toContain('infra/backups');
  });

  it('13. EAS production uses secrets for API URLs (not hardcoded example.com)', () => {
    const eas = readFileSync(join(ROOT, 'eas.json'), 'utf-8');
    expect(eas).toContain('EXPO_PUBLIC_USE_MOCK_API');
    expect(eas).toContain('EXPO_PUBLIC_USE_MOCK_REALTIME');
    expect(eas).not.toContain('example.com');
    const easEnvExample = readFileSync(join(ROOT, 'eas.production.env.example'), 'utf-8');
    expect(easEnvExample).toContain('EXPO_PUBLIC_API_URL');
    expect(easEnvExample).toContain('EXPO_PUBLIC_REALTIME_URL');
  });
});
