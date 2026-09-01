import { appStorage } from '@/services/storage';

const CONSENT_KEY = 'nkt_consent';

export interface ConsentState {
  privacyConsent: boolean;
  advertisingConsent: boolean;
  personalizationConsent: boolean;
  updatedAt: string;
}

const defaultConsent = (): ConsentState => ({
  privacyConsent: false,
  advertisingConsent: false,
  personalizationConsent: false,
  updatedAt: new Date().toISOString(),
});

class ConsentService {
  private cache: ConsentState | null = null;

  async getConsent(): Promise<ConsentState> {
    if (this.cache) return this.cache;
    const stored = await appStorage.getJSON<ConsentState>(CONSENT_KEY);
    this.cache = stored ?? defaultConsent();
    return this.cache;
  }

  async setConsent(patch: Partial<ConsentState>): Promise<ConsentState> {
    const current = await this.getConsent();
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.cache = updated;
    await appStorage.setJSON(CONSENT_KEY, updated);
    return updated;
  }

  hasAdvertisingConsent(): boolean {
    return this.cache?.advertisingConsent ?? false;
  }

  async load(): Promise<ConsentState> {
    return this.getConsent();
  }

  _reset(): void {
    this.cache = null;
  }
}

export const consentService = new ConsentService();
