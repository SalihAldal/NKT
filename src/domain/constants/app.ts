export const APP_NAME = 'NKT';
export const STORAGE_KEYS = {
  authToken: 'nkt_auth_token',
  refreshToken: 'nkt_refresh_token',
  user: 'nkt_user',
  identity: 'nkt_identity',
  settings: 'nkt_settings',
  entitlement: 'nkt_entitlement',
  guestSession: 'nkt_guest_session',
  onboardingComplete: 'nkt_onboarding_complete',
} as const;

export const DEEP_LINK_PATHS = {
  quiz: '/test',
  sharedQuiz: '/quiz',
  invite: '/invite',
  room: '/room',
} as const;

export const QUIZ_LIMITS = {
  FREE_MAX_QUESTIONS: 10,
  PREMIUM_MAX_QUESTIONS: 50,
  FREE_MAX_QUIZZES_PER_MONTH: 3,
  MIN_QUESTIONS: 3,
  DEFAULT_QUESTIONS: 10,
} as const;

export const PREMIUM_PRODUCT_IDS = {
  ios: {
    weekly: 'com.nkt.app.premium.weekly',
    monthly: 'com.nkt.app.premium.monthly',
    yearly: 'com.nkt.app.premium.yearly',
  },
  android: {
    weekly: 'nkt_premium_weekly',
    monthly: 'nkt_premium_monthly',
    yearly: 'nkt_premium_yearly',
  },
} as const;

/** Legacy quiz creation categories — maps to domain category slugs */
export const QUIZ_CATEGORIES = [
  { id: 'know-me', label: 'Beni ne kadar tanıyorsun?', icon: 'heart' as const, emoji: '💜', domainCategoryId: 'cat-taniyorsun' },
  { id: 'partner', label: 'Sevgilimi ne kadar tanıyorsun?', icon: 'people' as const, emoji: '💑', domainCategoryId: 'cat-ask-iliski' },
  { id: 'friend', label: 'Arkadaşımı ne kadar tanıyorsun?', icon: 'person' as const, emoji: '👥', domainCategoryId: 'cat-arkadaslik-krizi' },
  { id: 'family', label: 'Ailemi ne kadar tanıyorsun?', icon: 'home' as const, emoji: '👨‍👩‍👧', domainCategoryId: 'cat-cocukluk' },
  { id: 'fun', label: 'Eğlenceli test', icon: 'happy' as const, emoji: '😄', domainCategoryId: 'cat-parti' },
  { id: 'custom', label: 'Kendi testini oluştur', icon: 'create' as const, emoji: '✨', domainCategoryId: 'cat-tuhaf-absurt' },
] as const;
