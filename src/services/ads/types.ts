import type { Entitlement } from '@/domain/models/user';

export type AdType = 'banner' | 'interstitial' | 'rewarded';

export interface AdRewardResult {
  rewarded: boolean;
  rewardType?: string;
}

export interface AdService {
  initialize(): Promise<void>;
  shouldShowAds(entitlement: Entitlement | null): boolean;
  showBanner(placement: string, entitlement?: Entitlement | null): Promise<void>;
  hideBanner(): void;
  showInterstitial(placement: string, entitlement?: Entitlement | null): Promise<boolean>;
  showRewarded(placement: string, rewardType: string, entitlement?: Entitlement | null): Promise<AdRewardResult>;
  setPremiumUser(isPremium: boolean): void;
}
