const isDev = __DEV__;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[NKT]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[NKT]', ...args);
  },
  warn: (...args: unknown[]) => console.warn('[NKT]', ...args),
  error: (...args: unknown[]) => console.error('[NKT]', ...args),
};
