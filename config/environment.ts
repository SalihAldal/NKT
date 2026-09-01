import Constants from 'expo-constants';
import { APP_ENV, type AppEnvironment } from '@/domain/constants/enums';

const getEnv = (): AppEnvironment => {
  const value = process.env.EXPO_PUBLIC_APP_ENV;
  if (value === APP_ENV.STAGING) return APP_ENV.STAGING;
  if (value === APP_ENV.PRODUCTION) return APP_ENV.PRODUCTION;
  return APP_ENV.DEVELOPMENT;
};

const appEnv = getEnv();
const explicitMockApi = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
const explicitRealApi = process.env.EXPO_PUBLIC_USE_MOCK_API === 'false';
const explicitMockRealtime = process.env.EXPO_PUBLIC_USE_MOCK_REALTIME === 'true';
const explicitRealRealtime = process.env.EXPO_PUBLIC_USE_MOCK_REALTIME === 'false';

function resolveUseMockApi(): boolean {
  if (appEnv === APP_ENV.PRODUCTION) {
    if (explicitMockApi) {
      console.error('[NKT] FATAL: EXPO_PUBLIC_USE_MOCK_API=true is not allowed in production');
    }
    return false;
  }
  if (explicitRealApi) return false;
  if (explicitMockApi) return true;
  return appEnv === APP_ENV.DEVELOPMENT;
}

function resolveUseMockRealtime(): boolean {
  if (appEnv === APP_ENV.PRODUCTION) {
    if (explicitMockRealtime) {
      console.error('[NKT] FATAL: EXPO_PUBLIC_USE_MOCK_REALTIME=true is not allowed in production');
    }
    return false;
  }
  if (explicitRealRealtime) return false;
  if (explicitMockRealtime) return true;
  if (explicitMockApi) return true;
  return appEnv === APP_ENV.DEVELOPMENT;
}

const useMockApi = resolveUseMockApi();
const useMockRealtime = resolveUseMockRealtime();

if (appEnv === APP_ENV.PRODUCTION) {
  if (!process.env.EXPO_PUBLIC_API_URL) {
    console.error('[NKT] FATAL: EXPO_PUBLIC_API_URL is required in production');
  }
  if (!process.env.EXPO_PUBLIC_REALTIME_URL) {
    console.error('[NKT] FATAL: EXPO_PUBLIC_REALTIME_URL is required in production');
  }
}

const defaultApiUrl = appEnv === APP_ENV.PRODUCTION ? '' : 'http://localhost:3000';
const defaultRealtimeUrl = appEnv === APP_ENV.PRODUCTION ? '' : 'http://localhost:3000';

export const env = {
  appEnv,
  isDevelopment: appEnv === APP_ENV.DEVELOPMENT,
  isStaging: appEnv === APP_ENV.STAGING,
  isProduction: appEnv === APP_ENV.PRODUCTION,
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl,
  realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL ?? process.env.EXPO_PUBLIC_API_URL ?? defaultRealtimeUrl,
  useMockApi,
  useMockRealtime,
  deepLinkHost: process.env.EXPO_PUBLIC_DEEP_LINK_HOST ?? 'taniyormusun.app',
  appScheme: 'nkt',
  isDev: __DEV__,
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  minSupportedVersion: process.env.EXPO_PUBLIC_MIN_SUPPORTED_VERSION ?? '1.0.0',
} as const;

export function validateProductionConfig(): void {
  if (!env.isProduction) return;
  if (env.useMockApi) throw new Error('Mock API cannot be enabled in production');
  if (env.useMockRealtime) throw new Error('Mock realtime cannot be enabled in production');
  if (!env.apiUrl) throw new Error('EXPO_PUBLIC_API_URL is required in production');
  if (!env.realtimeUrl) throw new Error('EXPO_PUBLIC_REALTIME_URL is required in production');
}
