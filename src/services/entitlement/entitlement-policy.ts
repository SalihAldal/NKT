import type { Entitlement } from '@/domain/models/user';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { MONETIZATION_CONFIG } from '@config/monetization';

/** Central entitlement policy — client and server use same rules */
export class EntitlementPolicy {
  static hasPremiumAccess(entitlement: Entitlement): boolean {
    if (entitlement.status === ENTITLEMENT_STATUS.PREMIUM) return true;
    if (entitlement.status === ENTITLEMENT_STATUS.GRACE) return true;
    if (entitlement.status === ENTITLEMENT_STATUS.PENDING) return false;
    return false;
  }

  static isExpired(entitlement: Entitlement): boolean {
    if (entitlement.status === ENTITLEMENT_STATUS.EXPIRED) return true;
    if (entitlement.status === ENTITLEMENT_STATUS.REVOKED) return true;
    if (!entitlement.expiresAt) return false;
    return new Date(entitlement.expiresAt) < new Date();
  }

  static resolveEffectiveStatus(entitlement: Entitlement): Entitlement['status'] {
    if (entitlement.status === ENTITLEMENT_STATUS.REVOKED) return ENTITLEMENT_STATUS.REVOKED;
    if (!entitlement.expiresAt) {
      if (entitlement.status === ENTITLEMENT_STATUS.PREMIUM) return ENTITLEMENT_STATUS.PREMIUM;
      return entitlement.status;
    }
    const expiresAt = new Date(entitlement.expiresAt);
    const now = new Date();
    if (expiresAt > now) {
      if (entitlement.status === ENTITLEMENT_STATUS.GRACE) return ENTITLEMENT_STATUS.GRACE;
      return ENTITLEMENT_STATUS.PREMIUM;
    }
    const graceEnd = new Date(expiresAt.getTime() + MONETIZATION_CONFIG.gracePeriodDays * 86400000);
    if (now <= graceEnd) {
      return ENTITLEMENT_STATUS.GRACE;
    }
    return ENTITLEMENT_STATUS.EXPIRED;
  }

  static canCreatePremiumRoom(entitlement: Entitlement): boolean {
    return this.hasPremiumAccess(entitlement) && !this.isExpired(entitlement);
  }

  static canAccessPremiumFeature(entitlement: Entitlement): boolean {
    return this.hasPremiumAccess(entitlement);
  }

  static isStaleCache(entitlement: Entitlement): boolean {
    if (!entitlement.updatedAt) return true;
    const maxAge = MONETIZATION_CONFIG.staleEntitlementMaxHours * 3600000;
    return Date.now() - new Date(entitlement.updatedAt).getTime() > maxAge;
  }
}
