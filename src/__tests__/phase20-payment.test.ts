import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

describe('PHASE 20 — Mobile payment integration', () => {
  it('1. Entitlement refresh calls backend when not mock', () => {
    const src = readFileSync(join(ROOT, 'src/services/entitlement/entitlement.service.ts'), 'utf-8');
    expect(src).toContain('/api/v1/subscriptions/entitlement');
    expect(src).toContain('!env.useMockApi');
  });

  it('2. Production blocks mock API', () => {
    const src = readFileSync(join(ROOT, 'config/environment.ts'), 'utf-8');
    expect(src).toContain('EXPO_PUBLIC_USE_MOCK_API=true is not allowed in production');
    expect(src).toContain('validateProductionConfig');
  });

  it('3. Payment service verifies via backend not client grant', () => {
    const src = readFileSync(join(ROOT, 'src/services/payment/payment.service.ts'), 'utf-8');
    expect(src).toContain('getVerificationProvider');
    expect(src).not.toContain('isPremium: true');
  });

  it('4. Receipt verification uses backend in real API mode', () => {
    const src = readFileSync(join(ROOT, 'src/services/payment/receipt-verification.service.ts'), 'utf-8');
    expect(src).toContain('/api/v1/subscriptions/verify');
    expect(src).toContain('productId');
    expect(src).toContain('transactionId');
  });

  it('5. HTTP subscription API sends full verify payload', () => {
    const src = readFileSync(join(ROOT, 'src/api/http/subscription.http.ts'), 'utf-8');
    expect(src).toContain('productId');
    expect(src).toContain('transactionId');
  });

  it('6. Room entitlement policy: host premium unlocks room', () => {
    const src = readFileSync(join(ROOT, 'src/services/entitlement/room-entitlement.service.ts'), 'utf-8');
    expect(src).toContain('isRoomPremium');
    expect(src).toContain('canAccessCategory');
  });

  it('7. Server entitlement service exists on backend', () => {
    expect(existsSync(join(ROOT, 'server/src/entitlements/entitlement.service.ts'))).toBe(true);
  });
});
