import { env } from './environment';

/** Production-safe feature flag defaults */
export const FEATURE_FLAGS = {
  friend_room: true,
  premium: true,
  custom_category: true,
  adult_18: true,
  ads: !env.isProduction || process.env.EXPO_PUBLIC_ADS_ENABLED !== 'false',
  ai_generation: true,
  notifications: true,
  leaderboard: true,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key];
}
