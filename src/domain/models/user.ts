import type { AuthProvider, EntitlementStatus } from '../constants/enums';

export interface AuthIdentity {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerId?: string;
  email?: string;
  isVerified: boolean;
  createdAt: string;
  upgradedFromGuestId?: string;
}

export interface GuestSession {
  guestId: string;
  displayName: string;
  createdAt: string;
  expiresAt: string;
}

export interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'suspended' | 'deleted';
  role: 'user' | 'moderator' | 'admin';
}

export interface Profile {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  locale: string;
  stats: ProfileStats;
}

export interface ProfileStats {
  quizzesCreated: number;
  quizzesCompleted: number;
  gamesPlayed: number;
  averageScore: number;
  friendsCount: number;
  badgesCount: number;
}

export interface Entitlement {
  userId: string;
  status: EntitlementStatus;
  plan?: 'weekly' | 'monthly' | 'yearly';
  productId?: string;
  platform?: 'ios' | 'android';
  purchasedAt?: string;
  expiresAt?: string;
  verifiedAt?: string;
  transactionId?: string;
  originalTransactionId?: string;
  environment?: 'sandbox' | 'production';
  updatedAt?: string;
  source: 'iap' | 'promo' | 'admin' | 'unknown';
}

export function parseEntitlementSource(value?: string): Entitlement['source'] {
  if (value === 'iap' || value === 'promo' || value === 'admin' || value === 'unknown') return value;
  return 'unknown';
}

export interface Friend {
  id: string;
  userId: string;
  friendUserId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
}
