/**
 * Central release version metadata — single source of truth.
 * iOS buildNumber / Android versionCode set via EAS env at build time.
 */
export const RELEASE_VERSION = {
  app: '1.2.0',
  api: 'v1',
  admin: '1.2.0',
  worker: '1.2.0',
  iosBuildNumber: process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER ?? '1',
  androidVersionCode: Number(process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE ?? '12'),
} as const;

export const BUILD_METADATA = {
  name: 'NKT',
  bundleId: 'com.nkt.app',
  packageName: 'com.nkt.app',
} as const;
