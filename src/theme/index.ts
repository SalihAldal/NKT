export const colors = {
  background: '#0A0A0F',
  backgroundElevated: '#12121A',
  surface: '#1A1A24',
  surfaceGlass: 'rgba(26, 26, 36, 0.72)',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  card: '#16161F',
  cardHover: '#1E1E2A',

  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  textInverse: '#0A0A0F',

  primary: '#8B5CF6',
  primaryLight: '#A78BFA',
  primaryDark: '#6D28D9',
  accent: '#EC4899',
  accentOrange: '#F97316',
  highlight: '#FACC15',

  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  premium: '#F97316',
  premiumGold: '#FBBF24',

  overlay: 'rgba(0, 0, 0, 0.6)',
  shimmer: 'rgba(255, 255, 255, 0.06)',
  glow: 'rgba(139, 92, 246, 0.35)',
} as const;

export const gradients = {
  primary: ['#8B5CF6', '#EC4899', '#F97316'] as const,
  primarySoft: ['#6D28D9', '#A855F7'] as const,
  premium: ['#F97316', '#EC4899', '#8B5CF6'] as const,
  card: ['#1A1028', '#12121A'] as const,
  surface: ['rgba(139, 92, 246, 0.15)', 'rgba(236, 72, 153, 0.05)'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
} as const;

export const typography = {
  hero: { fontSize: 32, lineHeight: 40, fontWeight: '800' as const },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  small: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 18, stiffness: 200 },
} as const;

export const theme = {
  colors,
  gradients,
  spacing,
  radii,
  typography,
  shadows,
  iconSizes,
  animation,
} as const;

export type Theme = typeof theme;
