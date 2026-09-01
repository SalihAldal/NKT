export const isProductionMonetization = process.env.EXPO_PUBLIC_APP_ENV === 'production';

export type SubscriptionPlanType = 'weekly' | 'monthly';
export type PlatformType = 'ios' | 'android';

export interface SubscriptionProductConfig {
  productId: string;
  platform: PlatformType;
  type: SubscriptionPlanType;
  price: string;
  currency: string;
  active: boolean;
  displayOrder: number;
}

const productIds = {
  ios: {
    weekly: process.env.EXPO_PUBLIC_IOS_PREMIUM_WEEKLY ?? 'com.nkt.app.premium.weekly',
    monthly: process.env.EXPO_PUBLIC_IOS_PREMIUM_MONTHLY ?? 'com.nkt.app.premium.monthly',
  },
  android: {
    weekly: process.env.EXPO_PUBLIC_ANDROID_PREMIUM_WEEKLY ?? 'nkt_premium_weekly',
    monthly: process.env.EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY ?? 'nkt_premium_monthly',
  },
};

export const MONETIZATION_CONFIG = {
  products: {
    weekly: { durationDays: 7, label: 'Haftalık' },
    monthly: { durationDays: 30, label: 'Aylık' },
  },
  gracePeriodDays: Number(process.env.EXPO_PUBLIC_GRACE_PERIOD_DAYS ?? 3),
  staleEntitlementMaxHours: Number(process.env.EXPO_PUBLIC_STALE_ENTITLEMENT_HOURS ?? 24),
  ads: {
    enabled: process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false',
    rewardedEnabled: process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED !== 'false',
    maxInterstitialPerSession: 3,
    minInterstitialIntervalMs: 120_000,
    rewardedCooldownMs: 300_000,
  },
  freeBenefits: [
    '5 ücretsiz kategori',
    'Temel quiz özellikleri',
    'Arkadaş Ortamı',
    'Free room',
  ],
  premiumBenefits: [
    '15 premium kategori',
    'Sınırsız quiz oluşturma',
    'AI soru üretimi',
    'Premium temalar',
    'Gelişmiş istatistikler',
    'Reklamsız deneyim',
    'Custom category',
    'Premium room',
  ],
} as const;

export const getSubscriptionProducts = (platform: PlatformType = 'ios'): SubscriptionProductConfig[] => {
  const ids = productIds[platform];
  return [
    {
      productId: ids.weekly,
      platform,
      type: 'weekly' as SubscriptionPlanType,
      price: '₺29,99',
      currency: 'TRY',
      active: true,
      displayOrder: 1,
    },
    {
      productId: ids.monthly,
      platform,
      type: 'monthly' as SubscriptionPlanType,
      price: '₺49,99',
      currency: 'TRY',
      active: true,
      displayOrder: 2,
    },
  ].filter((p) => p.active);
};

export const getProductIdForPlan = (plan: SubscriptionPlanType, platform: PlatformType = 'ios'): string =>
  productIds[platform][plan];

export const resolvePlanFromProductId = (productId: string): SubscriptionPlanType | null => {
  if (productId === productIds.ios.weekly || productId === productIds.android.weekly) return 'weekly';
  if (productId === productIds.ios.monthly || productId === productIds.android.monthly) return 'monthly';
  return null;
};
