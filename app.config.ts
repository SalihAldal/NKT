import { ExpoConfig, ConfigContext } from 'expo/config';

const APP_SCHEME = 'nkt';
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? '1.2.0';
const IOS_BUILD = process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER ?? '1';
const ANDROID_VERSION_CODE = Number(process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE ?? '12');
const IS_PRODUCTION = process.env.EXPO_PUBLIC_APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'NKT',
  slug: 'nkt',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: APP_SCHEME,
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.nkt.app',
    buildNumber: IOS_BUILD,
    associatedDomains: ['applinks:taniyormusun.app', 'applinks:www.taniyormusun.app'],
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.nkt.app',
    versionCode: ANDROID_VERSION_CODE,
    ...(process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === 'true'
      ? { usesCleartextTraffic: true }
      : {}),
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0A0A0F',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'taniyormusun.app', pathPrefix: '/test' },
          { scheme: 'https', host: 'taniyormusun.app', pathPrefix: '/invite' },
          { scheme: 'https', host: 'taniyormusun.app', pathPrefix: '/quiz' },
          { scheme: 'https', host: 'taniyormusun.app', pathPrefix: '/room' },
          { scheme: APP_SCHEME },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0A0A0F',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#8B5CF6',
      },
    ],
    'expo-font',
    'expo-image',
    'expo-sharing',
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? (IS_PRODUCTION ? '' : 'http://localhost:3000'),
    useMockApi: !IS_PRODUCTION && process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false',
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    deepLinkHost: process.env.EXPO_PUBLIC_DEEP_LINK_HOST ?? 'taniyormusun.app',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
