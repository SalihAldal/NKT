/**
 * Release / store configuration.
 * URLs must be configured before store submission — never hardcode fake URLs.
 */
export const RELEASE_CONFIG = {
  /** Configure in .env before submission */
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '',
  termsOfServiceUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL ?? '',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',

  /** Store metadata — fill in release/store-metadata.template.json */
  appStore: {
    appName: 'NKT',
    subtitle: 'Ne Kadar Tanıyorsun?',
    category: 'Games',
    ageRating: '17+',
  },

  googlePlay: {
    title: 'NKT — Ne Kadar Tanıyorsun?',
    category: 'GAME_TRIVIA',
    contentRating: 'Mature 17+',
    containsAds: true,
    targetAudience: '18+',
  },

  /** No cross-app tracking — ATT not required unless ads SDK enables it */
  usesTracking: process.env.EXPO_PUBLIC_USES_TRACKING === 'true',
} as const;

export function getLegalUrl(type: 'privacy' | 'terms' | 'support'): string | null {
  const map = {
    privacy: RELEASE_CONFIG.privacyPolicyUrl,
    terms: RELEASE_CONFIG.termsOfServiceUrl,
    support: RELEASE_CONFIG.supportUrl,
  };
  const url = map[type];
  return url && url.startsWith('http') ? url : null;
}
