/** Central enum and constant values — no magic strings in business logic */

export const ENTITLEMENT_STATUS = {
  FREE: 'free',
  PREMIUM: 'premium',
  EXPIRED: 'expired',
  PENDING: 'pending',
  GRACE: 'grace',
  REVOKED: 'revoked',
  UNKNOWN: 'unknown',
} as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUS)[keyof typeof ENTITLEMENT_STATUS];

export const AUTH_PROVIDER = {
  USERNAME: 'username',
  GUEST: 'guest',
  EMAIL: 'email',
  APPLE: 'apple',
  GOOGLE: 'google',
} as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

export const GAME_CONTENT_TYPE = {
  QUESTION: 'question',
  CHALLENGE: 'challenge',
  PERFORMANCE: 'performance',
} as const;
export type GameContentType = (typeof GAME_CONTENT_TYPE)[keyof typeof GAME_CONTENT_TYPE];

export const ANSWER_TYPE = {
  CHOICE: 'choice',
  TEXT: 'text',
  ACTION: 'action',
  NONE: 'none',
} as const;
export type AnswerType = (typeof ANSWER_TYPE)[keyof typeof ANSWER_TYPE];

export const DIFFICULTY_LEVELS = [1, 2, 3] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const ROOM_STATE = {
  LOBBY: 'lobby',
  CATEGORY_SELECTION: 'category_selection',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ROUND_RESULT: 'round_result',
  FINAL_RESULT: 'final_result',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type RoomState = (typeof ROOM_STATE)[keyof typeof ROOM_STATE];

export const CONNECTION_STATE = {
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
} as const;
export type ConnectionState = (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE];

export const SUBSCRIPTION_PLAN = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN];

export const PURCHASE_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RESTORED: 'restored',
  EXPIRED: 'expired',
} as const;

export const PAYWALL_CONTEXT = {
  PREMIUM_SCREEN: 'premium_screen',
  LOCKED_CATEGORY: 'locked_category',
  AI_GENERATION: 'ai_generation',
  CUSTOM_CATEGORY: 'custom_category',
  PREMIUM_ROOM: 'premium_room',
  ADS: 'ads',
  ADVANCED_STATS: 'advanced_stats',
} as const;
export type PaywallContext = (typeof PAYWALL_CONTEXT)[keyof typeof PAYWALL_CONTEXT];
export type PurchaseStatus = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

export const MODERATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  HIDDEN: 'hidden',
} as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS];

export const REPORT_TYPE = {
  USER: 'user',
  CONTENT: 'content',
  ROOM: 'room',
  QUIZ: 'quiz',
  ACTIVITY: 'activity',
} as const;
export type ReportType = (typeof REPORT_TYPE)[keyof typeof REPORT_TYPE];

export const REPORT_REASON = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  INAPPROPRIATE: 'inappropriate',
  SEXUAL: 'sexual',
  DANGEROUS: 'dangerous_challenge',
  IMPERSONATION: 'impersonation',
  OTHER: 'other',
} as const;
export type ReportReason = (typeof REPORT_REASON)[keyof typeof REPORT_REASON];

export const FRIENDSHIP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  BLOCKED: 'blocked',
  REMOVED: 'removed',
} as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS)[keyof typeof FRIENDSHIP_STATUS];

export const INVITATION_TYPE = {
  FRIEND: 'friend',
  QUIZ: 'quiz',
  ROOM: 'room',
  GAME: 'game',
} as const;
export type InvitationType = (typeof INVITATION_TYPE)[keyof typeof INVITATION_TYPE];

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
} as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const PROFILE_VISIBILITY = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private',
} as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[keyof typeof PROFILE_VISIBILITY];

export const ACTIVITY_TYPE = {
  QUIZ_CREATED: 'quiz_created',
  QUIZ_COMPLETED: 'quiz_completed',
  GAME_COMPLETED: 'game_completed',
  GAME_WON: 'game_won',
  FRIEND_JOINED: 'friend_joined',
} as const;
export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];

export const CUSTOM_CATEGORY_VISIBILITY = {
  PRIVATE: 'private',
  ROOM_ONLY: 'room-only',
} as const;
export type CustomCategoryVisibility =
  (typeof CUSTOM_CATEGORY_VISIBILITY)[keyof typeof CUSTOM_CATEGORY_VISIBILITY];

export const CUSTOM_CATEGORY_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  MODERATION_PENDING: 'moderation_pending',
} as const;
export type CustomCategoryStatus =
  (typeof CUSTOM_CATEGORY_STATUS)[keyof typeof CUSTOM_CATEGORY_STATUS];

export const NOTIFICATION_TYPE = {
  FRIEND_REQUEST: 'friend_request',
  FRIEND_ACCEPTED: 'friend_accepted',
  QUIZ_RECEIVED: 'quiz_received',
  QUIZ_COMPLETED: 'quiz_completed',
  FRIEND_JOINED_ROOM: 'friend_joined_room',
  YOUR_TURN: 'your_turn',
  GAME_STARTED: 'game_started',
  GAME_COMPLETED: 'game_completed',
  ROOM_INVITE: 'room_invite',
  ROOM_STARTING: 'room_starting',
  INVITE: 'invite',
  PREMIUM: 'premium',
  SYSTEM: 'system',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const QUIZ_VISIBILITY = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private',
} as const;
export type QuizVisibility = (typeof QUIZ_VISIBILITY)[keyof typeof QUIZ_VISIBILITY];

export const QUIZ_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type QuizStatus = (typeof QUIZ_STATUS)[keyof typeof QUIZ_STATUS];

export const QUESTION_TYPE = {
  MULTIPLE_CHOICE: 'multiple_choice',
  OPEN_ENDED: 'open_ended',
} as const;
export type QuestionType = (typeof QUESTION_TYPE)[keyof typeof QUESTION_TYPE];

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const MINIMUM_CONTENT_TARGET = 300;
export const FREE_CATEGORY_COUNT = 5;
export const TOTAL_CATEGORY_COUNT = 20;

export const ERROR_CATEGORY = {
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  ENTITLEMENT: 'entitlement',
  ROOM: 'room',
  GAME: 'game',
  CONTENT: 'content',
  PAYMENT: 'payment',
  MODERATION: 'moderation',
  UNKNOWN: 'unknown',
} as const;
export type ErrorCategory = (typeof ERROR_CATEGORY)[keyof typeof ERROR_CATEGORY];

export const APP_ENV = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;
export type AppEnvironment = (typeof APP_ENV)[keyof typeof APP_ENV];
