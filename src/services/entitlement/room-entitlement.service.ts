import type { Entitlement } from '@/domain/models/user';
import type { GameRoom, RoomEntitlementSnapshot } from '@/domain/models/game';
import { PREMIUM_CATEGORY_IDS } from '@/domain/constants/categories';
import { entitlementError } from '@/services/errors/app-error';
import { EntitlementPolicy } from './entitlement-policy';
import { serverEntitlementService } from './server-entitlement.service';

export class PremiumAccessPolicy {
  /** Host premium → room premium (server-authoritative) */
  static isRoomPremium(hostEntitlement: Entitlement): boolean {
    return EntitlementPolicy.canCreatePremiumRoom(hostEntitlement);
  }

  static isRoomPremiumForHost(hostUserId: string): boolean {
    const server = serverEntitlementService.getEntitlement(hostUserId);
    return EntitlementPolicy.canCreatePremiumRoom(server);
  }

  static canAccessCategory(
    categoryId: string,
    hostEntitlement: Entitlement,
    isFreeCategory: boolean,
  ): boolean {
    if (isFreeCategory) return true;
    return this.isRoomPremium(hostEntitlement);
  }

  static canAccessPremiumContent(hostEntitlement: Entitlement): boolean {
    return this.isRoomPremium(hostEntitlement);
  }

  static assertPremiumCategoryAccess(
    categoryId: string,
    hostEntitlement: Entitlement,
    isFreeCategory: boolean,
  ): void {
    if (!this.canAccessCategory(categoryId, hostEntitlement, isFreeCategory)) {
      throw entitlementError('Bu kategori premium üyelik gerektirir.');
    }
  }
}

export class RoomEntitlementService {
  evaluateRoom(hostUserId: string, hostEntitlement: Entitlement, roomId: string): RoomEntitlementSnapshot {
    const serverEntitlement = serverEntitlementService.getEntitlement(hostUserId);
    const isPremiumRoom = PremiumAccessPolicy.isRoomPremium(serverEntitlement);
    return {
      roomId,
      hostUserId,
      hostEntitlementStatus: serverEntitlement.status,
      isPremiumRoom,
      premiumCategoryIds: isPremiumRoom ? [...PREMIUM_CATEGORY_IDS] : [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  applyToRoom(room: GameRoom, snapshot: RoomEntitlementSnapshot): GameRoom {
    return {
      ...room,
      isPremiumRoom: snapshot.isPremiumRoom,
      updatedAt: snapshot.evaluatedAt,
    };
  }
}

export const roomEntitlementService = new RoomEntitlementService();
