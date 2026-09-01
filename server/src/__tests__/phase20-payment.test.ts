import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { isAllowedProductId, resolvePlanDays } from '../entitlements/product-catalog.js';
import { shouldApplyWebhookEvent } from '../entitlements/event-ordering.js';

const SERVER = join(process.cwd());

describe('PHASE 20 — Payment & entitlement', () => {
  describe('Product catalog whitelist', () => {
    it('accepts known iOS weekly product', () => {
      expect(isAllowedProductId('com.nkt.app.premium.weekly')).toBe(true);
    });

    it('accepts known Android monthly product', () => {
      expect(isAllowedProductId('nkt_premium_monthly')).toBe(true);
    });

    it('rejects fake product ID', () => {
      expect(isAllowedProductId('fake.premium.free')).toBe(false);
    });

    it('rejects client-manipulated price plan', () => {
      expect(isAllowedProductId('premium')).toBe(false);
    });

    it('resolves plan days correctly', () => {
      expect(resolvePlanDays('com.nkt.app.premium.weekly')).toBe(7);
      expect(resolvePlanDays('nkt_premium_monthly')).toBe(30);
    });
  });

  describe('Webhook event ordering', () => {
    it('applies event when no prior subscription update', () => {
      expect(shouldApplyWebhookEvent(null, new Date())).toBe(true);
    });

    it('rejects stale event after newer subscription update', () => {
      const updated = new Date('2026-08-28T12:00:00Z');
      const stale = new Date('2026-08-28T11:00:00Z');
      expect(shouldApplyWebhookEvent(updated, stale)).toBe(false);
    });

    it('accepts newer event after subscription update', () => {
      const updated = new Date('2026-08-28T11:00:00Z');
      const newer = new Date('2026-08-28T12:00:00Z');
      expect(shouldApplyWebhookEvent(updated, newer)).toBe(true);
    });
  });

  describe('Architecture files', () => {
    it('central entitlement service exists', () => {
      expect(existsSync(join(SERVER, 'src/entitlements/entitlement.service.ts'))).toBe(true);
    });

    it('verification uses product whitelist', () => {
      const src = readFileSync(join(SERVER, 'src/providers/payment/verification.provider.ts'), 'utf-8');
      expect(src).toContain('isAllowedProductId');
      expect(src).toContain('grantPremium');
    });

    it('webhooks handle refund and revoke', () => {
      const src = readFileSync(join(SERVER, 'src/payments/webhook.routes.ts'), 'utf-8');
      expect(src).toContain('processRefund');
      expect(src).toContain('revokeEntitlement');
      expect(src).toContain('expireEntitlement');
    });

    it('production blocks mock payment', () => {
      const cfg = readFileSync(join(SERVER, 'src/config/index.ts'), 'utf-8');
      expect(cfg).toContain('USE_MOCK_PAYMENT');
      expect(cfg).toContain('not allowed in production');
    });

    it('room routes use isHostPremium', () => {
      const src = readFileSync(join(SERVER, 'src/rooms/room.routes.ts'), 'utf-8');
      expect(src).toContain('isHostPremium');
    });

    it('AI routes require premium entitlement', () => {
      const src = readFileSync(join(SERVER, 'src/ai/ai.routes.ts'), 'utf-8');
      expect(src).toContain('hasEntitlement');
    });

    it('game service uses isPremiumRoom snapshot for content', () => {
      const src = readFileSync(join(SERVER, 'src/games/game.service.ts'), 'utf-8');
      expect(src).toContain('isPremiumRoom');
      expect(src).toMatch(/premium:\s*isPremiumRoom/);
    });
  });
});
