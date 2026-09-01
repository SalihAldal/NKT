import { getCategoryById } from '@/domain/constants/categories';

export interface AgeAccessContext {
  userId?: string;
  isGuest: boolean;
  birthYear?: number;
}

/** Guest users cannot access +18 content by default */
export const GUEST_CAN_ACCESS_ADULT = false;

export class AgeRestrictionService {
  canAccessCategory(categoryId: string, ctx: AgeAccessContext): boolean {
    const cat = getCategoryById(categoryId);
    if (!cat) return false;
    return this.canAccessRating(cat.ageRating, ctx);
  }

  canAccessRating(rating: string, ctx: AgeAccessContext): boolean {
    if (rating !== '18+') return true;
    if (ctx.isGuest && !GUEST_CAN_ACCESS_ADULT) return false;
    if (ctx.birthYear) {
      const age = new Date().getFullYear() - ctx.birthYear;
      return age >= 18;
    }
    return false;
  }
}

export const ageRestrictionService = new AgeRestrictionService();
