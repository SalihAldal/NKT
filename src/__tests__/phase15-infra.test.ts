import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const INFRA = join(ROOT, 'infra');

describe('PHASE 15 — Production Infrastructure', () => {
  describe('Docker files', () => {
    it('1. server Dockerfile exists', () => {
      expect(existsSync(join(INFRA, 'docker/Dockerfile.server'))).toBe(true);
    });
    it('2. admin Dockerfile exists', () => {
      expect(existsSync(join(INFRA, 'docker/Dockerfile.admin'))).toBe(true);
    });
    it('3. production compose exists', () => {
      expect(existsSync(join(INFRA, 'docker-compose.prod.yml'))).toBe(true);
    });
  });

  describe('Nginx', () => {
    it('4. nginx config exists', () => {
      expect(existsSync(join(INFRA, 'nginx/nginx.conf'))).toBe(true);
    });
    it('5. websocket proxy template exists', () => {
      const tpl = readFileSync(join(INFRA, 'nginx/conf.d/realtime.conf.template'), 'utf-8');
      expect(tpl).toContain('Upgrade');
      expect(tpl).toContain('socket.io');
    });
    it('6. security headers in api template', () => {
      const tpl = readFileSync(join(INFRA, 'nginx/conf.d/api.conf.template'), 'utf-8');
      expect(tpl).toContain('X-Frame-Options');
    });
  });

  describe('Scripts', () => {
    const scripts = ['deploy.sh', 'rollback.sh', 'backup-db.sh', 'restore-db.sh', 'check-production-config.sh', 'smoke-test.sh', 'validate-compose.sh'];
    scripts.forEach((s, i) => {
      it(`${7 + i}. ${s} exists`, () => {
        expect(existsSync(join(INFRA, 'scripts', s))).toBe(true);
      });
    });
  });

  describe('Environment', () => {
    it('14. production env example exists', () => {
      expect(existsSync(join(INFRA, 'env/.env.production.example'))).toBe(true);
    });
    it('15. staging env example exists', () => {
      expect(existsSync(join(INFRA, 'env/.env.staging.example'))).toBe(true);
    });
    it('16. no hardcoded secrets in production example', () => {
      const content = readFileSync(join(INFRA, 'env/.env.production.example'), 'utf-8');
      expect(content).not.toContain('sk_live');
      expect(content).toContain('CHANGE_ME');
    });
  });

  describe('Compose security', () => {
    it('17. postgres not publicly exposed in compose', () => {
      const compose = readFileSync(join(INFRA, 'docker-compose.prod.yml'), 'utf-8');
      const pgSection = compose.split('nkt-postgres:')[1]?.split('nkt-redis:')[0] ?? '';
      expect(pgSection).not.toMatch(/ports:\s*\n\s*-\s*['"]?5432/);
    });
    it('18. redis not publicly exposed in compose', () => {
      const compose = readFileSync(join(INFRA, 'docker-compose.prod.yml'), 'utf-8');
      const redisSection = compose.split('nkt-redis:')[1]?.split('nkt-api:')[0] ?? '';
      expect(redisSection).not.toMatch(/ports:\s*\n\s*-\s*['"]?6379/);
    });
    it('19. nginx is only public entry', () => {
      const compose = readFileSync(join(INFRA, 'docker-compose.prod.yml'), 'utf-8');
      expect(compose).toContain('nkt-nginx');
      expect(compose).toContain('NGINX_HTTP_PORT');
    });
  });

  describe('Server config', () => {
    it('20. SERVICE_ROLE in server env example', () => {
      const env = readFileSync(join(ROOT, 'server/.env.example'), 'utf-8');
      expect(env).toContain('SERVICE_ROLE');
    });
  });
});
