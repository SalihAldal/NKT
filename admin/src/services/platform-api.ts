import { http } from './http-client';

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MODERATOR'
  | 'CONTENT_MANAGER'
  | 'SUPPORT'
  | 'ANALYST';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface AdminUserRecord {
  id: string;
  displayName: string;
  username: string;
  email: string;
  accountType: string;
  isPremium: boolean;
  status: string;
  warningCount: number;
  contentRestricted: boolean;
  quizzesCreated: number;
  gamesPlayed: number;
  friendsCount: number;
  joinedAt: string;
  lastActiveAt: string;
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
  status: string;
  createdAt: string;
  expiresAt: string;
  game?: { currentStage: number };
}

export interface AdminGameRecord {
  id: string;
  roomId: string;
  roomCode?: string;
  categoryName: string;
  status: string;
  currentStage: number;
  totalStages: number;
  playerCount: number;
  scores: Array<{ userId: string; name: string; score: number; rank: number }>;
  startedAt: string;
  completedAt?: string;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface AdminPurchaseRecord {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  platform: string;
  state: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  timestamp: string;
}

export interface FeatureFlag {
  key: string;
  label: string;
  enabled: boolean;
  environment?: string;
  updatedAt: string;
}

export interface SystemHealthCheck {
  service: string;
  status: string;
  message: string;
  checkedAt: string;
}

export interface AnalyticsData {
  range: string;
  events: number;
  roomsCreated: number;
  gamesPlayed: number;
  newUsers: number;
  premiumConversions: number;
  retention7d: number;
  retention30d: number;
}

export interface ContentAnalyticsRow {
  categoryId: string;
  name: string;
  contentCount: number;
  completionRate: number;
  skipRate: number;
  reportRate: number;
  quality: number;
}

export const platformApi = {
  async login(email: string, password: string) {
    const data = await http.post<{ token: string; admin: AdminUser }>('/admin/auth/login', { email, password });
    return { token: data.token, admin: data.admin };
  },

  async logout() {
    try {
      await http.post('/admin/auth/logout');
    } catch {
      /* session may already be expired */
    }
  },

  async me(): Promise<AdminUser> {
    return http.get<AdminUser>('/admin/auth/me');
  },

  listUsers(params: { search?: string; status?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<AdminUserRecord>>('/admin/users', params);
  },

  getUser(userId: string) {
    return http.get<Record<string, unknown>>(`/admin/users/${userId}`);
  },

  suspendUser(userId: string, reason: string) {
    return http.post(`/admin/users/${userId}/suspend`, { reason });
  },

  unsuspendUser(userId: string, reason?: string) {
    return http.post(`/admin/users/${userId}/unsuspend`, { reason });
  },

  listRooms(params: { status?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<AdminRoomRecord>>('/admin/rooms', params);
  },

  getRoom(roomId: string) {
    return http.get<AdminRoomRecord & { games?: unknown[] }>(`/admin/rooms/${roomId}`);
  },

  closeRoom(roomId: string, reason?: string) {
    return http.post(`/admin/rooms/${roomId}/close`, { reason });
  },

  listGames(params: { status?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<AdminGameRecord>>('/admin/games', params);
  },

  getGame(gameId: string) {
    return http.get<AdminGameRecord>(`/admin/games/${gameId}`);
  },

  listReports(params: { status?: string; priority?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<AdminReport>>('/admin/reports', params);
  },

  resolveReport(reportId: string, status: 'resolved' | 'rejected' | 'escalated', reason: string) {
    return http.post(`/admin/reports/${reportId}/resolve`, { status, reason });
  },

  getModerationQueue() {
    return http.get<{ reports: AdminReport[]; customCategories: Array<{ id: string; name: string; status: string }> }>(
      '/admin/moderation/queue',
    );
  },

  moderateCustomCategory(id: string, action: 'approve' | 'reject') {
    return http.post(`/admin/moderation/custom-categories/${id}`, { action });
  },

  listPurchases(params: { page?: number; pageSize?: number; state?: string }) {
    return http.get<PaginatedResult<AdminPurchaseRecord>>('/admin/purchases', params);
  },

  listSubscriptions(params: { page?: number; pageSize?: number; status?: string }) {
    return http.get<PaginatedResult<Record<string, unknown>>>('/admin/subscriptions', params);
  },

  listNotifications(params: { page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<Record<string, unknown>>>('/admin/notifications', params);
  },

  sendNotification(body: { userId: string; type: string; title: string; body: string }) {
    return http.post('/admin/notifications/send', body);
  },

  listSupportTickets(params: { status?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<SupportTicket>>('/admin/support/tickets', params);
  },

  resolveSupportTicket(ticketId: string, status: 'resolved' | 'closed', note?: string) {
    return http.post(`/admin/support/tickets/${ticketId}/resolve`, { status, note });
  },

  getAnalytics(range: 'today' | '7d' | '30d' | '90d' = '7d') {
    return http.get<AnalyticsData>('/admin/analytics', { range });
  },

  getContentAnalytics() {
    return http.get<ContentAnalyticsRow[]>('/admin/analytics/content');
  },

  listQuizzes(params: { search?: string; status?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<Record<string, unknown>>>('/admin/quizzes', params);
  },

  listAuditLogs(params: { action?: string; page?: number; pageSize?: number }) {
    return http.get<PaginatedResult<AuditLogEntry>>('/admin/audit-logs', params);
  },

  getSystemHealth() {
    return http.get<SystemHealthCheck[]>('/admin/system/health');
  },

  listFeatureFlags() {
    return http.get<FeatureFlag[]>('/admin/system/feature-flags');
  },

  updateFeatureFlag(key: string, enabled: boolean, reason?: string) {
    return http.patch(`/admin/system/feature-flags/${key}`, { enabled, reason });
  },
};
