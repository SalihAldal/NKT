/** Social graph, anti-spam and notification config */

export const SOCIAL_CONFIG = {
  /** Max friend requests per user per hour */
  friendRequestLimitPerHour: 20,
  /** Max invites per user per hour */
  inviteLimitPerHour: 30,
  /** Max search requests per minute */
  searchLimitPerMinute: 30,
  /** Cooldown before re-inviting same user (ms) */
  inviteCooldownMs: 5 * 60 * 1000,
  /** Friend request expiry (ms) */
  friendRequestExpiryMs: 30 * 24 * 60 * 60 * 1000,
  /** Room invite expiry (ms) */
  roomInviteExpiryMs: 24 * 60 * 60 * 1000,
  /** Quiz invite expiry (ms) */
  quizInviteExpiryMs: 7 * 24 * 60 * 60 * 1000,
  /** Default profile visibility */
  defaultProfileVisibility: 'friends' as const,
  /** Default activity sharing */
  defaultActivitySharing: true,
  /** Default discoverability */
  defaultDiscoverable: true,
  /** Stale entitlement cache for offline (ms) — not used for social but kept for consistency */
  pageSize: 20,
} as const;

export type ProfileVisibility = 'public' | 'friends' | 'private';
