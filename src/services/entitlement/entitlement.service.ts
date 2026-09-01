import type { Entitlement } from '@/domain/models/user';
import { parseEntitlementSource } from '@/domain/models/user';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { env } from '@config/environment';
import { appStorage, secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { EntitlementPolicy } from './entitlement-policy';
import { serverEntitlementService } from './server-entitlement.service';
import { logger } from '@/utils/logger';

export interface EntitlementService {
  getEntitlement(userId: string): Promise<Entitlement>;
  setEntitlement(entitlement: Entitlement): Promise<Entitlement>;
  syncFromServer(serverEntitlement: Entitlement): Promise<Entitlement>;
  clearEntitlement(userId: string): Promise<void>;
  isPremium(userId: string): Promise<boolean>;
  canAccessPremiumFeature(userId: string): Promise<boolean>;
  refreshFromServer(userId: string): Promise<Entitlement>;
}

class EntitlementServiceImpl implements EntitlementService {
  private cache = new Map<string, Entitlement>();

  async getEntitlement(userId: string): Promise<Entitlement> {
    const cached = this.cache.get(userId);
    if (cached && !EntitlementPolicy.isStaleCache(cached)) {
      const effective = EntitlementPolicy.resolveEffectiveStatus(cached);
      if (effective !== cached.status) {
        const updated = { ...cached, status: effective, updatedAt: new Date().toISOString() };
        this.cache.set(userId, updated);
        await appStorage.setJSON(`${STORAGE_KEYS.entitlement}:${userId}`, updated);
        return updated;
      }
      return cached;
    }

    const stored = await appStorage.getJSON<Entitlement>(`${STORAGE_KEYS.entitlement}:${userId}`);
    if (stored) {
      const effective = EntitlementPolicy.resolveEffectiveStatus(stored);
      const resolved = { ...stored, status: effective, updatedAt: stored.updatedAt ?? new Date().toISOString() };
      this.cache.set(userId, resolved);
      return resolved;
    }

    return {
      userId,
      status: ENTITLEMENT_STATUS.FREE,
      source: 'unknown',
      updatedAt: new Date().toISOString(),
    };
  }

  async setEntitlement(entitlement: Entitlement): Promise<Entitlement> {
    if (env.useMockApi) {
      serverEntitlementService._setDirect(entitlement);
    }
    return this.syncFromServer(entitlement);
  }

  async syncFromServer(serverEntitlement: Entitlement): Promise<Entitlement> {
    const effective = EntitlementPolicy.resolveEffectiveStatus(serverEntitlement);
    const synced = { ...serverEntitlement, status: effective, updatedAt: new Date().toISOString() };
    this.cache.set(serverEntitlement.userId, synced);
    await appStorage.setJSON(`${STORAGE_KEYS.entitlement}:${serverEntitlement.userId}`, synced);
    return synced;
  }

  async refreshFromServer(userId: string): Promise<Entitlement> {
    if (!env.useMockApi) {
      try {
        const token = await secureStorage.get(STORAGE_KEYS.authToken);
        const res = await fetch(`${env.apiUrl}/api/v1/subscriptions/entitlement`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json() as {
          success: boolean;
          data?: { userId: string; status: string; source?: string; expiresAt?: string | null; updatedAt?: string };
        };
        if (json.success && json.data) {
          return this.syncFromServer({
            userId: json.data.userId,
            status: json.data.status as Entitlement['status'],
            source: parseEntitlementSource(json.data.source),
            expiresAt: json.data.expiresAt ?? undefined,
            updatedAt: json.data.updatedAt ?? new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.warn('Backend entitlement refresh failed', err);
      }
    }
    const server = serverEntitlementService.getEntitlement(userId);
    return this.syncFromServer(server);
  }

  async clearEntitlement(userId: string): Promise<void> {
    this.cache.delete(userId);
    await appStorage.remove(`${STORAGE_KEYS.entitlement}:${userId}`);
  }

  async isPremium(userId: string): Promise<boolean> {
    const entitlement = await this.getEntitlement(userId);
    return EntitlementPolicy.hasPremiumAccess(entitlement);
  }

  async canAccessPremiumFeature(userId: string): Promise<boolean> {
    return this.isPremium(userId);
  }
}

export const entitlementService = new EntitlementServiceImpl();
