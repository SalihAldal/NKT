import { tr } from './locales/tr';
import { en } from './locales/en';
import type { TranslationSchema } from './types';

const locales: Record<'tr' | 'en', TranslationSchema> = { tr, en };

export type Locale = keyof typeof locales;

export const getTranslations = (locale: Locale): TranslationSchema => locales[locale] ?? tr;

export const t = (locale: Locale, key: string, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: unknown = getTranslations(locale);
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k];
  }
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
    value,
  );
};

export { tr, en };
