import { APP_ENV } from '@/domain/constants/enums';

export const PROVIDER_CONFIG = {
  ads: {
    enabled: process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false',
    rewardedEnabled: process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED !== 'false',
    testMode: process.env.EXPO_PUBLIC_APP_ENV !== APP_ENV.PRODUCTION,
    units: {
      ios: {
        banner: process.env.EXPO_PUBLIC_IOS_AD_BANNER ?? 'ca-app-pub-3940256099942544/2934735716',
        interstitial: process.env.EXPO_PUBLIC_IOS_AD_INTERSTITIAL ?? 'ca-app-pub-3940256099942544/4411468910',
        rewarded: process.env.EXPO_PUBLIC_IOS_AD_REWARDED ?? 'ca-app-pub-3940256099942544/1712485313',
      },
      android: {
        banner: process.env.EXPO_PUBLIC_ANDROID_AD_BANNER ?? 'ca-app-pub-3940256099942544/6300978111',
        interstitial: process.env.EXPO_PUBLIC_ANDROID_AD_INTERSTITIAL ?? 'ca-app-pub-3940256099942544/1033173712',
        rewarded: process.env.EXPO_PUBLIC_ANDROID_AD_REWARDED ?? 'ca-app-pub-3940256099942544/5224354917',
      },
    },
  },
  monitoring: {
    enabled: process.env.EXPO_PUBLIC_ERROR_MONITORING !== 'false',
  },
} as const;
