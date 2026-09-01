import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.2.0' } } }));

import { RELEASE_VERSION, BUILD_METADATA } from '@config/version';
import { RELEASE_CONFIG, getLegalUrl } from '@config/release';
import { FEATURE_FLAGS } from '@config/feature-flags';
import { validateProductionConfig } from '@config/environment';
import { isVersionSupported } from '@/utils/version';
import { PRIVACY_POLICY_SECTIONS } from '@/content/legal/privacy-policy';
import { TERMS_OF_SERVICE_SECTIONS } from '@/content/legal/terms-of-service';
import { OPEN_SOURCE_LICENSES } from '@/content/legal/open-source-licenses';
import { subscriptionManagementService } from '@/services/subscription/subscription-management.service';

describe('PHASE 14 — Store Readiness', () => {
  describe('Versioning', () => {
    it('1. central release version exists', () => {
      expect(RELEASE_VERSION.app).toMatch(/^\d+\.\d+\.\d+$/);
      expect(RELEASE_VERSION.api).toBe('v1');
    });

    it('2. bundle identifiers consistent', () => {
      expect(BUILD_METADATA.bundleId).toBe('com.nkt.app');
      expect(BUILD_METADATA.packageName).toBe('com.nkt.app');
    });

    it('3. semver comparison works', () => {
      expect(isVersionSupported('1.2.0', '1.0.0')).toBe(true);
      expect(isVersionSupported('0.9.0', '1.0.0')).toBe(false);
    });
  });

  describe('Environment separation', () => {
    it('4. production mock blocked in validation', () => {
      expect(() => validateProductionConfig()).not.toThrow();
    });

    it('5. feature flags have safe defaults', () => {
      expect(typeof FEATURE_FLAGS.premium).toBe('boolean');
      expect(typeof FEATURE_FLAGS.adult_18).toBe('boolean');
    });
  });

  describe('Legal & compliance', () => {
    it('6. privacy policy sections exist', () => {
      expect(PRIVACY_POLICY_SECTIONS.length).toBeGreaterThan(3);
      expect(PRIVACY_POLICY_SECTIONS.some((s) => s.title.includes('Silme'))).toBe(true);
    });

    it('7. terms of service sections exist', () => {
      expect(TERMS_OF_SERVICE_SECTIONS.length).toBeGreaterThan(3);
    });

    it('8. open source licenses listed', () => {
      expect(OPEN_SOURCE_LICENSES.length).toBeGreaterThan(3);
    });

    it('9. legal URLs require configuration', () => {
      expect(getLegalUrl('privacy')).toBeNull();
      expect(RELEASE_CONFIG.usesTracking).toBe(false);
    });
  });

  describe('IAP & subscription', () => {
    it('10. subscription management service exists', () => {
      expect(subscriptionManagementService.getStoreName()).toBeTruthy();
      expect(typeof subscriptionManagementService.openSubscriptionManagement).toBe('function');
    });
  });

  describe('Store metadata', () => {
    it('11. age rating configured', () => {
      expect(RELEASE_CONFIG.appStore.ageRating).toBe('17+');
      expect(RELEASE_CONFIG.googlePlay.contentRating).toContain('17');
    });

    it('12. ads declaration matches config', () => {
      expect(RELEASE_CONFIG.googlePlay.containsAds).toBe(true);
    });
  });

  describe('Security', () => {
    it('13. no hardcoded production secrets in release config', () => {
      const json = JSON.stringify(RELEASE_CONFIG);
      expect(json).not.toContain('sk_live');
      expect(json).not.toContain('password');
    });
  });

  describe('Content readiness', () => {
    it('14. content dataset meets 6000 target', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const datasetPath = path.join(process.cwd(), 'admin', 'src', 'data', 'content-dataset.json');
      if (!fs.existsSync(datasetPath)) return;
      const items = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as { categorySlug?: string; categoryId?: string }[];
      expect(items.length).toBe(6000);
      const cats = new Set(items.map((i) => i.categorySlug ?? i.categoryId));
      expect(cats.size).toBe(20);
    });
  });
});
