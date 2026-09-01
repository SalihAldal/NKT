import type { User as DomainUser, Profile, Entitlement } from '../models/user';
import type { User as UiUser, PremiumEntitlement } from '@/types';

export const mapProfileToUiUser = (
  user: DomainUser,
  profile: Profile,
  entitlement: Entitlement,
): UiUser => ({
  id: user.id,
  email: '',
  name: profile.displayName,
  username: profile.username,
  avatar: profile.avatarUrl,
  isPremium: entitlement.status === 'premium',
  premiumExpiresAt: entitlement.expiresAt,
  stats: {
    quizzesCreated: profile.stats?.quizzesCreated ?? 0,
    quizzesCompleted: profile.stats?.quizzesCompleted ?? 0,
    averageScore: profile.stats?.averageScore ?? 0,
    friendsCount: profile.stats?.friendsCount ?? 0,
    badgesCount: profile.stats?.badgesCount ?? 0,
  },
  createdAt: user.createdAt,
});

export const mapEntitlementToUi = (entitlement: Entitlement): PremiumEntitlement => ({
  isPremium: entitlement.status === 'premium',
  expiresAt: entitlement.expiresAt,
  productId: entitlement.productId,
  verified: entitlement.source !== 'unknown' && entitlement.verifiedAt !== undefined,
});

export const mapUiUserToProfileUpdate = (
  ui: Partial<UiUser>,
): Partial<Pick<Profile, 'displayName' | 'username' | 'avatarUrl'>> => ({
  ...(ui.name !== undefined ? { displayName: ui.name } : {}),
  ...(ui.username !== undefined ? { username: ui.username } : {}),
  ...(ui.avatar !== undefined ? { avatarUrl: ui.avatar } : {}),
});
