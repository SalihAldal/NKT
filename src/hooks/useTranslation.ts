import { useSettingsStore } from '@/store/settingsStore';
import { t, type Locale } from '@/i18n';

export const useTranslation = () => {
  const language = useSettingsStore((s) => s.settings.language);
  const locale: Locale = language === 'en' ? 'en' : 'tr';
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => t(locale, key, params),
  };
};
