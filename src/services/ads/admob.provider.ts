import { logger } from '@/utils/logger';
import { analytics } from '@/services/analytics';
import { MONETIZATION_CONFIG } from '@config/monetization';
import { PROVIDER_CONFIG } from '@config/providers';
import { consentService } from '@/services/consent/consent.service';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import type { Entitlement } from '@/domain/models/user';
import type { AdType, AdRewardResult, AdService } from './types';

class AdFrequencyTracker {
  private interstitialCount = 0;
  private lastInterstitialAt = 0;
  private lastRewardedAt = 0;

  canShowInterstitial(): boolean {
    if (this.interstitialCount >= MONETIZATION_CONFIG.ads.maxInterstitialPerSession) return false;
    if (Date.now() - this.lastInterstitialAt < MONETIZATION_CONFIG.ads.minInterstitialIntervalMs) return false;
    return true;
  }

  recordInterstitial(): void { this.interstitialCount += 1; this.lastInterstitialAt = Date.now(); }
  canShowRewarded(): boolean { return Date.now() - this.lastRewardedAt >= MONETIZATION_CONFIG.ads.rewardedCooldownMs; }
  recordRewarded(): void { this.lastRewardedAt = Date.now(); }
  _reset(): void { this.interstitialCount = 0; this.lastInterstitialAt = 0; this.lastRewardedAt = 0; }
}

const frequency = new AdFrequencyTracker();

async function grantRewardOnBackend(placement: string, rewardType: string, verificationToken: string): Promise<boolean> {
  if (env.useMockApi) return true;
  try {
    const token = await secureStorage.get(STORAGE_KEYS.authToken);
    const res = await fetch(`${env.apiUrl}/api/v1/rewards/ad-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ placement, rewardType, verificationToken }),
    });
    const json = await res.json() as { success: boolean };
    return json.success;
  } catch {
    return false;
  }
}

class AdMobAdProvider implements AdService {
  private isPremiumFlag = false;

  async initialize() {
    logger.debug('AdMob provider initialized', { testMode: PROVIDER_CONFIG.ads.testMode });
  }

  setPremiumUser(isPremium: boolean) { this.isPremiumFlag = isPremium; }

  shouldShowAds(entitlement: Entitlement | null): boolean {
    if (!PROVIDER_CONFIG.ads.enabled) return false;
    if (this.isPremiumFlag) return false;
    if (entitlement && EntitlementPolicy.hasPremiumAccess(entitlement)) return false;
    if (!consentService.hasAdvertisingConsent()) return false;
    return true;
  }

  private trackAd(type: AdType, placement: string, event: string) {
    analytics.track({ name: event as 'ad_requested', params: { type, placement } });
  }

  async showBanner(placement: string, entitlement?: Entitlement | null) {
    if (!this.shouldShowAds(entitlement ?? null)) return;
    this.trackAd('banner', placement, 'ad_impression');
  }

  hideBanner() { logger.debug('Banner hidden'); }

  async showInterstitial(placement: string, entitlement?: Entitlement | null): Promise<boolean> {
    if (!this.shouldShowAds(entitlement ?? null) || !frequency.canShowInterstitial()) return false;
    this.trackAd('interstitial', placement, 'ad_impression');
    frequency.recordInterstitial();
    return true;
  }

  async showRewarded(placement: string, rewardType: string, entitlement?: Entitlement | null): Promise<AdRewardResult> {
    if (!PROVIDER_CONFIG.ads.rewardedEnabled || !this.shouldShowAds(entitlement ?? null) || !frequency.canShowRewarded()) {
      return { rewarded: false };
    }
    this.trackAd('rewarded', placement, 'reward_started');
    const verificationToken = `ad-verified-${Date.now()}-${placement}`;
    const granted = await grantRewardOnBackend(placement, rewardType, verificationToken);
    if (!granted) return { rewarded: false };
    analytics.track({ name: 'reward_granted', params: { placement, rewardType } });
    frequency.recordRewarded();
    return { rewarded: true, rewardType };
  }
}

export const adService = new AdMobAdProvider();
export const _adFrequencyTracker = frequency;
