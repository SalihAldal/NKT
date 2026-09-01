import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const isProd = process.env.NODE_ENV === 'production';
const useMock = process.env.VITE_ADMIN_USE_MOCK ?? (isProd ? 'false' : 'false');

if (isProd && useMock === 'true') {
  throw new Error('Production admin build cannot use VITE_ADMIN_USE_MOCK=true');
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@nkt/server': fileURLToPath(new URL('../src/services/admin/index.ts', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL ?? '/api/v1'),
    'import.meta.env.VITE_ADMIN_USE_MOCK': JSON.stringify(useMock),
  },
});
