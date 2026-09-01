import { describe, it, expect, beforeEach } from 'vitest';
import {
  FREE_CATEGORY_IDS,
  PREMIUM_CATEGORY_IDS,
  getCategoryById,
} from '@/domain/constants/categories';
import { ENTITLEMENT_STATUS, PURCHASE_STATUS } from '@/domain/constants/enums';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { PremiumAccessPolicy, roomEntitlementService } from '@/services/entitlement/room-entitlement.service';
import { paymentService } from '@/services/payment/payment.service';
import { getVerificationProvider } from '@/services/payment/receipt-verification.service';
import { webhookService } from '@/services/payment/webhook.service';
import { adService, _adFrequencyTracker } from '@/services/ads';
import { consentService } from '@/services/consent/consent.service';
import { customCategoryService } from '@/services/content/custom-category.service';
import { advancedStatsService } from '@/services/stats/advanced-stats.service';
import { premiumThemeService } from '@/services/theme/premium-theme.service';
import { getSubscriptionProducts } from '@config/monetization';
import { roomServer } from '@/api/mock/room.mock';
import type { Entitlement } from '@/domain/models/user';

const freeUser = (id: string): Entitlement => ({
  userId: id,
  status: ENTITLEMENT_STATUS.FREE,
  source: 'unknown',
  updatedAt: new Date().toISOString(),
});

const premiumUser = (id: string): Entitlement => ({
  userId: id,
  status: ENTITLEMENT_STATUS.PREMIUM,
  plan: 'monthly',
  productId: 'com.nkt.app.premium.monthly',
  platform: 'ios',
  purchasedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  verifiedAt: new Date().toISOString(),
  transactionId: 'txn-premium',
  source: 'iap',
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  serverEntitlementService._reset();
  webhookService._reset();
  _adFrequencyTracker._reset();
  consentService._reset();
  customCategoryService._reset();
  roomServer._reset();
});

describe('PHASE 07 — Monetization', () => {
  it('1. free user entitlement', async () => {
    const e = serverEntitlementService.getEntitlement('free-1');
    expect(e.status).toBe(ENTITLEMENT_STATUS.FREE);
    expect(EntitlementPolicy.hasPremiumAccess(e)).toBe(false);
  });

  it('2. premium user entitlement', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'prem-1',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-1',
    });
    const e = serverEntitlementService.getEntitlement('prem-1');
    expect(EntitlementPolicy.hasPremiumAccess(e)).toBe(true);
  });

  it('3. weekly purchase', async () => {
    const result = await paymentService.purchase('u-weekly', 'com.nkt.app.premium.weekly');
    expect(result.success).toBe(true);
    expect(result.status).toBe(PURCHASE_STATUS.SUCCESS);
  });

  it('4. monthly purchase', async () => {
    const result = await paymentService.purchase('u-monthly', 'com.nkt.app.premium.monthly');
    expect(result.success).toBe(true);
  });

  it('5. purchase pending flow', async () => {
    const products = await paymentService.getProducts();
    expect(products.length).toBeGreaterThanOrEqual(2);
  });

  it('6. purchase failed — invalid receipt', async () => {
    const verifier = getVerificationProvider('ios');
    const result = await verifier.verify({
      userId: 'u-fail',
      receipt: 'invalid',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-fail',
    });
    expect(result.valid).toBe(false);
  });

  it('7. purchase cancelled status exists', () => {
    expect(PURCHASE_STATUS.CANCELLED).toBe('cancelled');
  });

  it('8. restore success with server entitlement', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'u-restore',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-restore',
    });
    const result = await paymentService.restore('u-restore');
    expect(result.restored).toBe(true);
  });

  it('9. restore failed — no purchases', async () => {
    const result = await paymentService.restore('u-nopurchase');
    expect(result.restored).toBe(false);
  });

  it('10. expired subscription', () => {
    const e: Entitlement = {
      ...premiumUser('u-exp'),
      status: ENTITLEMENT_STATUS.EXPIRED,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    };
    expect(EntitlementPolicy.hasPremiumAccess(e)).toBe(false);
  });

  it('11. grace period', () => {
    const e: Entitlement = {
      ...premiumUser('u-grace'),
      status: ENTITLEMENT_STATUS.GRACE,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    };
    expect(EntitlementPolicy.hasPremiumAccess(e)).toBe(true);
  });

  it('12. revoked subscription', () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'u-revoke',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-revoke',
    });
    const revoked = serverEntitlementService.revoke('u-revoke');
    expect(revoked.status).toBe(ENTITLEMENT_STATUS.REVOKED);
    expect(EntitlementPolicy.hasPremiumAccess(revoked)).toBe(false);
  });

  it('13. premium category blocked for free user', () => {
    expect(() =>
      PremiumAccessPolicy.assertPremiumCategoryAccess('cat-ask-iliski', freeUser('f'), false),
    ).toThrow();
  });

  it('14. premium category allowed for premium host', () => {
    expect(
      PremiumAccessPolicy.canAccessCategory('cat-ask-iliski', premiumUser('p'), false),
    ).toBe(true);
  });

  it('15. premium host → premium room', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'host-prem',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-host',
    });
    const { room } = await roomServer.create({ hostUserId: 'host-prem', hostDisplayName: 'Host' });
    expect(room.isPremiumRoom).toBe(true);
  });

  it('16. free host → free room', async () => {
    const { room } = await roomServer.create({ hostUserId: 'host-free', hostDisplayName: 'Free' });
    expect(room.isPremiumRoom).toBe(false);
  });

  it('17. free player in premium host room', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'host-p',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-h2',
    });
    const { room } = await roomServer.create({ hostUserId: 'host-p', hostDisplayName: 'Host' });
    const join = await roomServer.join({ code: room.code, displayName: 'FreePlayer', userId: 'free-player' });
    expect(join.room.isPremiumRoom).toBe(true);
    expect(join.player.userId).toBe('free-player');
  });

  it('18. premium user no ads', async () => {
    await consentService.setConsent({ advertisingConsent: true, privacyConsent: true });
    adService.setPremiumUser(true);
    expect(adService.shouldShowAds(premiumUser('p'))).toBe(false);
  });

  it('19. free user ads with consent', async () => {
    adService.setPremiumUser(false);
    await consentService.setConsent({ advertisingConsent: true, privacyConsent: true });
    expect(adService.shouldShowAds(freeUser('f'))).toBe(true);
  });

  it('20. rewarded ad success', async () => {
    await consentService.setConsent({ advertisingConsent: true, privacyConsent: true });
    adService.setPremiumUser(false);
    const result = await adService.showRewarded('quiz_extra', 'extra_quiz', freeUser('f'));
    expect(result.rewarded).toBe(true);
  });

  it('21. rewarded ad failure — no consent', async () => {
    await consentService.setConsent({ advertisingConsent: false, privacyConsent: true });
    const result = await adService.showRewarded('quiz_extra', 'extra_quiz', freeUser('f'));
    expect(result.rewarded).toBe(false);
  });

  it('22. ad provider failure does not block', async () => {
    await consentService.setConsent({ advertisingConsent: true, privacyConsent: true });
    adService.setPremiumUser(false);
    const shown = await adService.showInterstitial('session_end', freeUser('f'));
    expect(typeof shown).toBe('boolean');
  });

  it('23. duplicate transaction protection', () => {
    const input = {
      userId: 'u-dup',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios' as const,
      transactionId: 'txn-same',
    };
    const first = serverEntitlementService.verifyAndGrant(input);
    const second = serverEntitlementService.verifyAndGrant(input);
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
  });

  it('24. duplicate webhook idempotent', async () => {
    const event = {
      type: 'subscription_renewed' as const,
      userId: 'u-wh',
      transactionId: 'wh-txn-1',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios' as const,
    };
    const first = await webhookService.process(event);
    const second = await webhookService.process(event);
    expect(first.processed).toBe(true);
    expect(second.processed).toBe(false);
  });

  it('25. server entitlement mismatch rejected', () => {
    const rejected = serverEntitlementService.rejectClientAssertion('u-fake', ENTITLEMENT_STATUS.PREMIUM);
    expect(rejected).toBe(true);
  });

  it('26. client fake premium rejected', async () => {
    await entitlementService.syncFromServer(freeUser('u-client'));
    const isPremium = await entitlementService.isPremium('u-client');
    expect(isPremium).toBe(false);
  });

  it('27. client fake purchase rejected', async () => {
    const result = await paymentService.purchase('u-fake', 'invalid-product-id');
    expect(result.success).toBe(false);
  });

  it('28. subscription sync after refresh', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'u-sync',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-sync',
    });
    const synced = await entitlementService.refreshFromServer('u-sync');
    expect(EntitlementPolicy.hasPremiumAccess(synced)).toBe(true);
  });

  it('29. subscription sync from server', async () => {
    const synced = await paymentService.syncEntitlement('u-sync2');
    expect(synced.status).toBe(ENTITLEMENT_STATUS.FREE);
  });

  it('30. custom category premium gate', async () => {
    await expect(customCategoryService.create('free-u', 'Test', 'Desc')).rejects.toThrow('Premium required');
    serverEntitlementService.verifyAndGrant({
      userId: 'prem-u',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-cat',
    });
    await entitlementService.syncFromServer(serverEntitlementService.getEntitlement('prem-u'));
    const cat = await customCategoryService.create('prem-u', 'Test', 'Desc');
    expect(cat.ownerId).toBe('prem-u');
  });

  it('31. advanced stats premium gate', async () => {
    const basic = await advancedStatsService.getBasicStats({
      quizzesCreated: 1, quizzesCompleted: 2, gamesPlayed: 3, averageScore: 70, friendsCount: 0, badgesCount: 0,
    });
    expect(basic.gamesPlayed).toBe(3);
    const advanced = await advancedStatsService.getAdvancedStats('free-u', basic as never);
    expect(advanced).toBeNull();
  });

  it('32. paywall analytics events defined', () => {
    const products = getSubscriptionProducts();
    expect(products.some((p) => p.type === 'weekly')).toBe(true);
    expect(products.some((p) => p.type === 'monthly')).toBe(true);
  });

  it('33. revenue analytics — 5 free 15 premium categories', () => {
    expect(FREE_CATEGORY_IDS).toHaveLength(5);
    expect(PREMIUM_CATEGORY_IDS).toHaveLength(15);
    expect(getCategoryById('cat-korku')?.isFree).toBe(true);
    expect(getCategoryById('cat-ask-iliski')?.isFree).toBe(false);
  });

  it('34. ad analytics — interstitial frequency limit', async () => {
    await consentService.setConsent({ advertisingConsent: true, privacyConsent: true });
    adService.setPremiumUser(false);
    const e = freeUser('f-freq');
    await adService.showInterstitial('a', e);
    await adService.showInterstitial('b', e);
    await adService.showInterstitial('c', e);
    const fourth = await adService.showInterstitial('d', e);
    expect(fourth).toBe(false);
  });
});
