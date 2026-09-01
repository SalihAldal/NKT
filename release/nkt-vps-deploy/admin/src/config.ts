const useMock = import.meta.env.VITE_ADMIN_USE_MOCK === 'true';
const isProd = import.meta.env.PROD;

if (isProd && useMock) {
  throw new Error('FATAL: VITE_ADMIN_USE_MOCK=true is not allowed in production admin builds.');
}

export const adminConfig = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  useMock,
  isProd,
} as const;
