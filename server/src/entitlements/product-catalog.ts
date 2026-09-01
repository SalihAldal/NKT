/** Server-side product whitelist — client cannot invent product IDs */
export const PRODUCT_CATALOG = {
  ios: {
    weekly: process.env.IOS_PREMIUM_WEEKLY ?? 'com.nkt.app.premium.weekly',
    monthly: process.env.IOS_PREMIUM_MONTHLY ?? 'com.nkt.app.premium.monthly',
  },
  android: {
    weekly: process.env.ANDROID_PREMIUM_WEEKLY ?? 'nkt_premium_weekly',
    monthly: process.env.ANDROID_PREMIUM_MONTHLY ?? 'nkt_premium_monthly',
  },
} as const;

const ALLOWED = new Set<string>([
  PRODUCT_CATALOG.ios.weekly,
  PRODUCT_CATALOG.ios.monthly,
  PRODUCT_CATALOG.android.weekly,
  PRODUCT_CATALOG.android.monthly,
]);

const PLAN_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
};

export function isAllowedProductId(productId: string): boolean {
  return ALLOWED.has(productId);
}

export function resolvePlanDays(productId: string): number {
  if (productId.includes('weekly')) return PLAN_DAYS.weekly!;
  return PLAN_DAYS.monthly!;
}

export function resolvePlanType(productId: string): 'weekly' | 'monthly' | null {
  if (productId === PRODUCT_CATALOG.ios.weekly || productId === PRODUCT_CATALOG.android.weekly) return 'weekly';
  if (productId === PRODUCT_CATALOG.ios.monthly || productId === PRODUCT_CATALOG.android.monthly) return 'monthly';
  return null;
}
