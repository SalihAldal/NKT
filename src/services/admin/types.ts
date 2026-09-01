export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MODERATOR'
  | 'CONTENT_MANAGER'
  | 'SUPPORT'
  | 'ANALYST';

export type AdminPermission =
  | 'user.read'
  | 'user.update'
  | 'user.suspend'
  | 'user.delete'
  | 'room.read'
  | 'room.close'
  | 'room.player.remove'
  | 'quiz.read'
  | 'quiz.moderate'
  | 'content.read'
  | 'content.create'
  | 'content.update'
  | 'content.delete'
  | 'content.approve'
  | 'content.reject'
  | 'category.update'
  | 'subscription.read'
  | 'purchase.read'
  | 'analytics.read'
  | 'report.read'
  | 'report.resolve'
  | 'support.read'
  | 'support.resolve'
  | 'settings.update'
  | 'audit.read'
  | 'audit.delete'
  | 'feature_flag.update'
  | 'notification.manage'
  | 'ads.manage'
  | 'entitlement.grant';

export interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminSession {
  id: string;
  adminId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
  requestId: string;
}

export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'rejected' | 'escalated';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'quiz' | 'content' | 'room' | 'custom_category';
  targetId: string;
  reason: string;
  description: string;
  status: ReportStatus;
  priority: ReportPriority;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
  resolverId?: string;
}

export type SupportStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type SupportCategory =
  | 'account'
  | 'payment'
  | 'premium'
  | 'room'
  | 'quiz'
  | 'game'
  | 'content'
  | 'bug'
  | 'other';

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  category: SupportCategory;
  message: string;
  status: SupportStatus;
  priority: ReportPriority;
  assignedTo?: string;
  notes: string[];
  relatedIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRecord {
  id: string;
  displayName: string;
  username: string;
  email: string;
  accountType: 'registered' | 'guest_linked';
  isPremium: boolean;
  status: 'active' | 'suspended' | 'warned';
  warningCount: number;
  contentRestricted: boolean;
  inviteRestricted: boolean;
  roomRestricted: boolean;
  quizzesCreated: number;
  quizzesCompleted: number;
  gamesPlayed: number;
  friendsCount: number;
  createdAt: string;
  lastActiveAt: string;
  reportedCount: number;
}

export interface AdminRoomRecord {
  id: string;
  code: string;
  hostUserId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isPremiumRoom: boolean;
  categoryId?: string;
  categoryName?: string;
  status: 'lobby' | 'playing' | 'completed' | 'expired' | 'closed';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  gameId?: string;
}

export interface AdminGameRecord {
  id: string;
  roomId: string;
  categoryId: string;
  categoryName: string;
  status: 'active' | 'completed' | 'aborted';
  currentStage: number;
  totalStages: number;
  playerCount: number;
  scores: Array<{ userId: string; name: string; score: number; rank: number }>;
  startedAt: string;
  completedAt?: string;
}

export interface AdminQuizRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category?: string;
  status: 'draft' | 'published' | 'private';
  visibility: 'public' | 'friends' | 'private';
  completionCount: number;
  reportCount: number;
  createdAt: string;
}

export interface AdminSubscriptionRecord {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  status: 'active' | 'expired' | 'grace' | 'revoked' | 'pending';
  provider: 'ios' | 'android';
  expiresAt: string;
  createdAt: string;
}

export interface AdminPurchaseRecord {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  platform: 'ios' | 'android';
  state: 'completed' | 'pending' | 'failed' | 'refunded' | 'duplicate';
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  key: string;
  label: string;
  enabled: boolean;
  environment: 'all' | 'production' | 'staging';
  updatedAt: string;
  updatedBy?: string;
}

export interface SystemHealthCheck {
  service: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  message: string;
  checkedAt: string;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  activeRooms: number;
  gamesToday: number;
  quizCompletions: number;
  premiumUsers: number;
  subscriptionConversion: number;
  revenue: number;
  adImpressions: number;
  reportsOpen: number;
  pendingModeration: number;
  contentCount: number;
  range: 'today' | '7d' | '30d' | '90d';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAuthResult {
  session: AdminSession;
  admin: Omit<AdminAccount, 'passwordHash'>;
}

export interface CustomCategoryRecord {
  id: string;
  ownerId: string;
  name: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export class AdminAuthError extends Error {
  constructor(message: string, public code: 'INVALID_CREDENTIALS' | 'SESSION_EXPIRED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'REAUTH_REQUIRED') {
    super(message);
    this.name = 'AdminAuthError';
  }
}
