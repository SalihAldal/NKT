import { appStorage } from '@/services/storage';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';

const THEME_KEY = 'nkt_premium_theme';

export const PREMIUM_THEMES = [
  { id: 'default', name: 'Standart', premium: false },
  { id: 'gold', name: 'Altın', premium: true },
  { id: 'midnight', name: 'Gece', premium: true },
  { id: 'sunset', name: 'Gün Batımı', premium: true },
] as const;

export type PremiumThemeId = (typeof PREMIUM_THEMES)[number]['id'];

class PremiumThemeService {
  private current: PremiumThemeId = 'default';

  async getTheme(userId: string): Promise<PremiumThemeId> {
    const stored = await appStorage.getJSON<PremiumThemeId>(`${THEME_KEY}:${userId}`);
    return stored ?? 'default';
  }

  async setTheme(userId: string, themeId: PremiumThemeId): Promise<PremiumThemeId> {
    const theme = PREMIUM_THEMES.find((t) => t.id === themeId);
    if (!theme) throw new Error('Unknown theme');
    if (theme.premium) {
      const isPremium = await entitlementService.isPremium(userId);
      if (!isPremium) throw new Error('Premium required for this theme');
    }
    this.current = themeId;
    await appStorage.setJSON(`${THEME_KEY}:${userId}`, themeId);
    return themeId;
  }

  getAvailableThemes(isPremium: boolean) {
    return PREMIUM_THEMES.filter((t) => !t.premium || isPremium);
  }

  getCurrentTheme() {
    return this.current;
  }
}

export const premiumThemeService = new PremiumThemeService();
