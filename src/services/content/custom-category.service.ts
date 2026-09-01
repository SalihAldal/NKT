import { v4 as uuidv4 } from 'uuid';
import type { CustomCategory } from '@/domain/models/category';
import {
  CUSTOM_CATEGORY_STATUS,
  CUSTOM_CATEGORY_VISIBILITY,
  MODERATION_STATUS,
} from '@/domain/constants/enums';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { moderationService } from '@/services/moderation/moderation.service';

const customCategories = new Map<string, CustomCategory>();

export class CustomCategoryService {
  async create(ownerId: string, name: string, description: string): Promise<CustomCategory> {
    const isPremium = await entitlementService.isPremium(ownerId);
    if (!isPremium) throw new Error('Premium required for custom categories');

    if (moderationService.filter.containsProfanity(name)) {
      throw new Error('Name not allowed');
    }

    const cat: CustomCategory = {
      id: uuidv4(),
      ownerId,
      name,
      description,
      contentIds: [],
      visibility: CUSTOM_CATEGORY_VISIBILITY.ROOM_ONLY,
      status: CUSTOM_CATEGORY_STATUS.MODERATION_PENDING,
      moderationStatus: MODERATION_STATUS.PENDING,
      metadata: { reportedCount: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customCategories.set(cat.id, cat);
    return cat;
  }

  async listForOwner(ownerId: string): Promise<CustomCategory[]> {
    return [...customCategories.values()].filter((c) => c.ownerId === ownerId);
  }

  async listForRoom(roomId: string, ownerId: string): Promise<CustomCategory[]> {
    return [...customCategories.values()].filter(
      (c) =>
        c.ownerId === ownerId &&
        c.status === CUSTOM_CATEGORY_STATUS.ACTIVE &&
        c.moderationStatus === MODERATION_STATUS.APPROVED &&
        c.visibility === CUSTOM_CATEGORY_VISIBILITY.ROOM_ONLY,
    );
  }

  /** No public discovery */
  async listPublic(): Promise<CustomCategory[]> {
    return [];
  }

  getById(id: string): CustomCategory | undefined {
    return customCategories.get(id);
  }

  _reset(): void {
    customCategories.clear();
  }
}

export const customCategoryService = new CustomCategoryService();
