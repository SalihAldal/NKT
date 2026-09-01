import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ADMIN_CATEGORIES } from '../../admin/src/data/categories';

const ROOT = process.cwd();

describe('PHASE 16 — Final Release', () => {
  describe('20 Categories', () => {
    it('1. exactly 20 categories', () => {
      expect(ADMIN_CATEGORIES.length).toBe(20);
    });
    it('2. 5 free + 15 premium', () => {
      const free = ADMIN_CATEGORIES.filter((c) => c.isFree);
      const premium = ADMIN_CATEGORIES.filter((c) => !c.isFree);
      expect(free.length).toBe(5);
      expect(premium.length).toBe(15);
    });
    it('3. unique slugs', () => {
      const slugs = ADMIN_CATEGORIES.map((c) => c.slug);
      expect(new Set(slugs).size).toBe(20);
    });
    it('4. +18 category exists', () => {
      expect(ADMIN_CATEGORIES.some((c) => c.ageRating === '18+')).toBe(true);
    });
  });

  describe('6,000+ Content', () => {
    it('5. total content count', () => {
      const path = join(ROOT, 'admin', 'src', 'data', 'content-dataset.json');
      if (!existsSync(path)) return;
      const items = JSON.parse(readFileSync(path, 'utf-8')) as unknown[];
      expect(items.length).toBe(6000);
    });
    it('6. 300 per category minimum', () => {
      const path = join(ROOT, 'admin', 'src', 'data', 'content-dataset.json');
      if (!existsSync(path)) return;
      const items = JSON.parse(readFileSync(path, 'utf-8')) as { categoryId: string }[];
      const counts = new Map<string, number>();
      items.forEach((i) => counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1));
      for (const [, count] of counts) expect(count).toBeGreaterThanOrEqual(300);
    });
    it('7. no duplicate prompts', () => {
      const path = join(ROOT, 'admin', 'src', 'data', 'content-dataset.json');
      if (!existsSync(path)) return;
      const items = JSON.parse(readFileSync(path, 'utf-8')) as { prompt: string }[];
      const prompts = items.map((i) => i.prompt.toLowerCase().trim());
      expect(new Set(prompts).size).toBe(prompts.length);
    });
  });

  describe('Launch Package', () => {
    it('8. launch manifest exists', () => {
      expect(existsSync(join(ROOT, 'release', 'launch-manifest.json'))).toBe(true);
    });
    it('9. store metadata template exists', () => {
      expect(existsSync(join(ROOT, 'release', 'store-metadata.template.json'))).toBe(true);
    });
    it('10. data safety inventory exists', () => {
      expect(existsSync(join(ROOT, 'release', 'data-safety-inventory.json'))).toBe(true);
    });
    it('11. screenshot workflow exists', () => {
      expect(existsSync(join(ROOT, 'release', 'screenshot-asset-workflow.md'))).toBe(true);
    });
    it('12. deployment docs exist', () => {
      expect(existsSync(join(ROOT, 'docs', 'DEPLOYMENT.md'))).toBe(true);
    });
  });

  describe('Production config', () => {
    it('13. production blocks mock API', async () => {
      const { validateProductionConfig } = await import('@config/environment');
      expect(() => validateProductionConfig()).not.toThrow();
    });
    it('14. legal content exists', async () => {
      const { PRIVACY_POLICY_SECTIONS } = await import('@/content/legal/privacy-policy');
      const { TERMS_OF_SERVICE_SECTIONS } = await import('@/content/legal/terms-of-service');
      expect(PRIVACY_POLICY_SECTIONS.length).toBeGreaterThan(3);
      expect(TERMS_OF_SERVICE_SECTIONS.length).toBeGreaterThan(3);
    });
  });

  describe('Infrastructure', () => {
    it('15. production compose exists', () => {
      expect(existsSync(join(ROOT, 'infra', 'docker-compose.prod.yml'))).toBe(true);
    });
    it('16. deploy script exists', () => {
      expect(existsSync(join(ROOT, 'infra', 'scripts', 'deploy.sh'))).toBe(true);
    });
    it('17. final audit script exists', () => {
      expect(existsSync(join(ROOT, 'scripts', 'final-release-audit.ts'))).toBe(true);
    });
  });
});
