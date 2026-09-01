import { auditService } from './audit';
import { roleHasPermission } from './permissions';
import {
  SEED_ADMINS,
  SEED_FEATURE_FLAGS,
  hashPassword,
  seedGames,
  seedPurchases,
  seedQuizzes,
  seedReports,
  seedRooms,
  seedSubscriptions,
  seedSupport,
  seedUsers,
} from './seed';
import type {
  AdminAccount,
  AdminAuthError,
  AdminAuthResult,
  CustomCategoryRecord,
  AdminDashboardMetrics,
  AdminGameRecord,
  AdminPermission,
  AdminPurchaseRecord,
  AdminQuizRecord,
  AdminReport,
  AdminRoomRecord,
  AdminSession,
  AdminSubscriptionRecord,
  AdminUserRecord,
  AuditLogEntry,
  FeatureFlag,
  PaginatedResult,
  ReportStatus,
  SupportTicket,
  SystemHealthCheck,
} from './types';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

let sessionCounter = 0;

export class AdminPlatform {
  private admins: AdminAccount[] = SEED_ADMINS.map((a) => ({ ...a }));
  private sessions = new Map<string, AdminSession>();
  private users: AdminUserRecord[] = seedUsers(120);
  private rooms: AdminRoomRecord[] = seedRooms(this.users);
  private games: AdminGameRecord[] = seedGames(this.rooms);
  private quizzes: AdminQuizRecord[] = seedQuizzes(this.users);
  private reports: AdminReport[] = seedReports(this.users);
  private tickets: SupportTicket[] = seedSupport(this.users);
  private subscriptions: AdminSubscriptionRecord[] = seedSubscriptions(this.users);
  private purchases: AdminPurchaseRecord[] = seedPurchases(this.users);
  private featureFlags: FeatureFlag[] = SEED_FEATURE_FLAGS.map((f) => ({ ...f }));
  private adsConfig = { enabled: true, rewardedEnabled: true, interstitialEnabled: true, frequencyCap: 3 };
  private notificationTemplates = [
    { id: 'tpl-1', category: 'quiz', title: 'Yeni Test', body: '{sender} sana bir test gönderdi', deepLink: 'nkt://quiz/{code}', active: true },
    { id: 'tpl-2', category: 'room', title: 'Oda Daveti', body: '{sender} seni odaya davet etti', deepLink: 'nkt://room/{code}', active: true },
  ];
  private customCategories: CustomCategoryRecord[] = [
    { id: 'cc-1', ownerId: 'user-1', name: 'Bizim Eğlence', status: 'REVIEW', createdAt: new Date().toISOString() },
  ];
  private userSessions = new Map<string, string[]>();

  // ─── Auth ───────────────────────────────────────────────

  login(email: string, password: string, ipAddress?: string): AdminAuthResult {
    const admin = this.admins.find((a) => a.email === email && a.isActive);
    if (!admin || admin.passwordHash !== hashPassword(password)) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' }) as AdminAuthError;
    }
    const session: AdminSession = {
      id: `sess-${++sessionCounter}`,
      adminId: admin.id,
      token: `token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      createdAt: new Date().toISOString(),
      ipAddress,
    };
    this.sessions.set(session.token, session);
    admin.lastLoginAt = new Date().toISOString();
    const { passwordHash: _, ...safe } = admin;
    return { session, admin: safe };
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  refreshSession(token: string): AdminSession {
    const session = this.validateSession(token);
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    return session;
  }

  validateSession(token: string): AdminSession {
    const session = this.sessions.get(token);
    if (!session) throw Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }) as AdminAuthError;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      throw Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }) as AdminAuthError;
    }
    return session;
  }

  getAdminByToken(token: string): Omit<AdminAccount, 'passwordHash'> {
    const session = this.validateSession(token);
    const admin = this.admins.find((a) => a.id === session.adminId && a.isActive);
    if (!admin) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' }) as AdminAuthError;
    const { passwordHash: _, ...safe } = admin;
    return safe;
  }

  authorize(token: string, permission: AdminPermission): Omit<AdminAccount, 'passwordHash'> {
    const admin = this.getAdminByToken(token);
    if (!roleHasPermission(admin.role, permission)) {
      throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' }) as AdminAuthError;
    }
    return admin;
  }

  requireReauth(token: string, password: string): void {
    const admin = this.getAdminByToken(token);
    const full = this.admins.find((a) => a.id === admin.id)!;
    if (full.passwordHash !== hashPassword(password)) {
      throw Object.assign(new Error('Re-auth required'), { code: 'REAUTH_REQUIRED' }) as AdminAuthError;
    }
  }

  private audit(admin: Omit<AdminAccount, 'passwordHash'>, action: string, targetType: string, targetId: string, opts?: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }) {
    return auditService.write({
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      targetType,
      targetId,
      ...opts,
    });
  }

  // ─── Dashboard ──────────────────────────────────────────

  getDashboard(token: string, range: AdminDashboardMetrics['range'] = '7d'): AdminDashboardMetrics {
    this.authorize(token, 'analytics.read');
    const multiplier = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const activeRooms = this.rooms.filter((r) => r.status === 'lobby' || r.status === 'playing').length;
    return {
      totalUsers: this.users.length,
      dau: Math.round(this.users.length * 0.12),
      wau: Math.round(this.users.length * 0.35),
      mau: Math.round(this.users.length * 0.55),
      activeRooms,
      gamesToday: this.games.filter((g) => g.status === 'active' || g.status === 'completed').length,
      quizCompletions: this.quizzes.reduce((s, q) => s + q.completionCount, 0),
      premiumUsers: this.users.filter((u) => u.isPremium).length,
      subscriptionConversion: 4.8,
      revenue: 12450 * (multiplier / 7),
      adImpressions: 45200 * (multiplier / 7),
      reportsOpen: this.reports.filter((r) => r.status === 'open' || r.status === 'investigating').length,
      pendingModeration: this.reports.filter((r) => r.status === 'open').length + this.customCategories.filter((c) => c.status === 'REVIEW').length,
      contentCount: 6000,
      range,
    };
  }

  // ─── Users ──────────────────────────────────────────────

  listUsers(token: string, filters: {
    search?: string;
    status?: string;
    premium?: boolean;
    guestLinked?: boolean;
    reported?: boolean;
    page?: number;
    pageSize?: number;
  } = {}): PaginatedResult<AdminUserRecord> {
    this.authorize(token, 'user.read');
    let items = [...this.users];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((u) => u.username.includes(q) || u.displayName.toLowerCase().includes(q) || u.id.includes(q));
    }
    if (filters.status) items = items.filter((u) => u.status === filters.status);
    if (filters.premium !== undefined) items = items.filter((u) => u.isPremium === filters.premium);
    if (filters.guestLinked) items = items.filter((u) => u.accountType === 'guest_linked');
    if (filters.reported) items = items.filter((u) => u.reportedCount > 0);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  getUser(token: string, userId: string): AdminUserRecord & { subscriptions: AdminSubscriptionRecord[]; recentTickets: SupportTicket[] } {
    this.authorize(token, 'user.read');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    return {
      ...user,
      subscriptions: this.subscriptions.filter((s) => s.userId === userId),
      recentTickets: this.tickets.filter((t) => t.userId === userId).slice(0, 5),
    };
  }

  suspendUser(token: string, userId: string, reason: string, password?: string): AdminUserRecord {
    const admin = this.authorize(token, 'user.suspend');
    if (admin.role !== 'SUPER_ADMIN') this.requireReauth(token, password ?? '');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const before = { status: user.status };
    user.status = 'suspended';
    this.audit(admin, 'user.suspend', 'user', userId, { before, after: { status: 'suspended' }, reason });
    return user;
  }

  unsuspendUser(token: string, userId: string, reason: string): AdminUserRecord {
    const admin = this.authorize(token, 'user.suspend');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const before = { status: user.status };
    user.status = 'active';
    this.audit(admin, 'user.unsuspend', 'user', userId, { before, after: { status: 'active' }, reason });
    return user;
  }

  warnUser(token: string, userId: string, reason: string): AdminUserRecord {
    const admin = this.authorize(token, 'user.update');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    user.warningCount += 1;
    user.status = 'warned';
    this.audit(admin, 'user.warn', 'user', userId, { after: { warningCount: user.warningCount }, reason });
    return user;
  }

  forceLogoutUser(token: string, userId: string): void {
    const admin = this.authorize(token, 'user.update');
    this.userSessions.delete(userId);
    this.audit(admin, 'user.force_logout', 'user', userId);
  }

  restrictUser(token: string, userId: string, restrictions: { content?: boolean; invite?: boolean; room?: boolean }, reason: string): AdminUserRecord {
    const admin = this.authorize(token, 'user.update');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    if (restrictions.content !== undefined) user.contentRestricted = restrictions.content;
    if (restrictions.invite !== undefined) user.inviteRestricted = restrictions.invite;
    if (restrictions.room !== undefined) user.roomRestricted = restrictions.room;
    this.audit(admin, 'user.restrict', 'user', userId, { after: restrictions as Record<string, unknown>, reason });
    return user;
  }

  // ─── Rooms ──────────────────────────────────────────────

  listRooms(token: string, filters: { status?: string; premium?: boolean; page?: number; pageSize?: number } = {}): PaginatedResult<AdminRoomRecord> {
    this.authorize(token, 'room.read');
    let items = [...this.rooms];
    if (filters.status) items = items.filter((r) => r.status === filters.status);
    if (filters.premium !== undefined) items = items.filter((r) => r.isPremiumRoom === filters.premium);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  getRoom(token: string, roomId: string): AdminRoomRecord & { game?: AdminGameRecord } {
    this.authorize(token, 'room.read');
    const room = this.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    const game = room.gameId ? this.games.find((g) => g.id === room.gameId) : undefined;
    return { ...room, game };
  }

  closeRoom(token: string, roomId: string, reason: string): AdminRoomRecord {
    const admin = this.authorize(token, 'room.close');
    const room = this.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    const before = { status: room.status };
    room.status = 'closed';
    room.updatedAt = new Date().toISOString();
    this.audit(admin, 'room.close', 'room', roomId, { before, after: { status: 'closed' }, reason });
    return room;
  }

  removePlayerFromRoom(token: string, roomId: string, playerId: string, reason: string): AdminRoomRecord {
    const admin = this.authorize(token, 'room.player.remove');
    const room = this.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    room.playerCount = Math.max(0, room.playerCount - 1);
    this.audit(admin, 'room.player.remove', 'room', roomId, { after: { removedPlayer: playerId }, reason });
    return room;
  }

  // ─── Games ──────────────────────────────────────────────

  listGames(token: string, filters: { status?: string; page?: number; pageSize?: number } = {}): PaginatedResult<AdminGameRecord> {
    this.authorize(token, 'room.read');
    let items = [...this.games];
    if (filters.status) items = items.filter((g) => g.status === filters.status);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  getGame(token: string, gameId: string): AdminGameRecord {
    this.authorize(token, 'room.read');
    const game = this.games.find((g) => g.id === gameId);
    if (!game) throw new Error('Game not found');
    return game;
  }

  abortGame(token: string, gameId: string, reason: string, password?: string): AdminGameRecord {
    const admin = this.authorize(token, 'room.close');
    this.requireReauth(token, password ?? '');
    const game = this.games.find((g) => g.id === gameId);
    if (!game) throw new Error('Game not found');
    game.status = 'aborted';
    game.completedAt = new Date().toISOString();
    this.audit(admin, 'game.abort', 'game', gameId, { after: { status: 'aborted' }, reason });
    return game;
  }

  // ─── Quizzes ────────────────────────────────────────────

  listQuizzes(token: string, filters: { search?: string; status?: string; reported?: boolean; page?: number; pageSize?: number } = {}): PaginatedResult<AdminQuizRecord> {
    this.authorize(token, 'quiz.read');
    let items = [...this.quizzes];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    if (filters.status) items = items.filter((i) => i.status === filters.status);
    if (filters.reported) items = items.filter((i) => i.reportCount > 0);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  // ─── Reports ────────────────────────────────────────────

  listReports(token: string, filters: { status?: ReportStatus; priority?: string; page?: number; pageSize?: number } = {}): PaginatedResult<AdminReport> {
    this.authorize(token, 'report.read');
    let items = [...this.reports];
    if (filters.status) items = items.filter((r) => r.status === filters.status);
    if (filters.priority) items = items.filter((r) => r.priority === filters.priority);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  resolveReport(token: string, reportId: string, status: ReportStatus, reason: string): AdminReport {
    const admin = this.authorize(token, 'report.resolve');
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found');
    const before = { status: report.status };
    report.status = status;
    report.resolvedAt = new Date().toISOString();
    report.resolverId = admin.id;
    this.audit(admin, 'report.resolve', 'report', reportId, { before, after: { status }, reason });
    return report;
  }

  assignReport(token: string, reportId: string, assigneeId: string): AdminReport {
    const admin = this.authorize(token, 'report.resolve');
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found');
    report.assignedTo = assigneeId;
    report.status = 'investigating';
    this.audit(admin, 'report.assign', 'report', reportId, { after: { assignedTo: assigneeId } });
    return report;
  }

  getModerationQueue(token: string): { reports: AdminReport[]; customCategories: CustomCategoryRecord[] } {
    this.authorize(token, 'report.read');
    return {
      reports: this.reports.filter((r) => r.status === 'open' || r.status === 'investigating'),
      customCategories: this.customCategories.filter((c) => c.status === 'REVIEW'),
    };
  }

  // ─── Custom Categories ──────────────────────────────────

  moderateCustomCategory(token: string, categoryId: string, action: 'approve' | 'reject' | 'disable', reason: string): void {
    const admin = this.authorize(token, 'content.approve');
    const cat = this.customCategories.find((c) => c.id === categoryId);
    if (!cat) throw new Error('Category not found');
    const before = { status: cat.status };
    if (action === 'approve') cat.status = 'APPROVED';
    if (action === 'reject') cat.status = 'DRAFT';
    if (action === 'disable') cat.status = 'DISABLED';
    this.audit(admin, `custom_category.${action}`, 'custom_category', categoryId, { before, after: { status: cat.status }, reason });
  }

  // ─── Support ────────────────────────────────────────────

  listSupportTickets(token: string, filters: { status?: string; category?: string; page?: number; pageSize?: number } = {}): PaginatedResult<SupportTicket> {
    this.authorize(token, 'support.read');
    let items = [...this.tickets];
    if (filters.status) items = items.filter((t) => t.status === filters.status);
    if (filters.category) items = items.filter((t) => t.category === filters.category);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  getSupportTicket(token: string, ticketId: string): SupportTicket {
    this.authorize(token, 'support.read');
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    return ticket;
  }

  resolveSupportTicket(token: string, ticketId: string, status: SupportTicket['status'], note: string): SupportTicket {
    const admin = this.authorize(token, 'support.resolve');
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    ticket.notes.push(`[${admin.displayName}] ${note}`);
    ticket.updatedAt = new Date().toISOString();
    this.audit(admin, 'support.resolve', 'support_ticket', ticketId, { after: { status }, reason: note });
    return ticket;
  }

  // ─── Subscriptions & Purchases ──────────────────────────

  listSubscriptions(token: string, filters: { status?: string; page?: number; pageSize?: number } = {}): PaginatedResult<AdminSubscriptionRecord> {
    this.authorize(token, 'subscription.read');
    let items = [...this.subscriptions];
    if (filters.status) items = items.filter((s) => s.status === filters.status);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  listPurchases(token: string, filters: { state?: string; page?: number; pageSize?: number } = {}): PaginatedResult<AdminPurchaseRecord> {
    this.authorize(token, 'purchase.read');
    let items = [...this.purchases];
    if (filters.state) items = items.filter((p) => p.state === filters.state);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }

  grantEntitlement(token: string, userId: string, productId: string, expiresAt: string, reason: string, password: string): AdminSubscriptionRecord {
    const admin = this.authorize(token, 'entitlement.grant');
    this.requireReauth(token, password);
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    user.isPremium = true;
    const sub: AdminSubscriptionRecord = {
      id: `sub-grant-${Date.now()}`,
      userId,
      userName: user.displayName,
      productId,
      status: 'active',
      provider: 'ios',
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.subscriptions.unshift(sub);
    this.audit(admin, 'entitlement.grant', 'user', userId, { after: { productId, expiresAt }, reason });
    return sub;
  }

  // ─── Ads ────────────────────────────────────────────────

  getAdsConfig(token: string) {
    this.authorize(token, 'ads.manage');
    return { ...this.adsConfig, premiumAdFree: true };
  }

  updateAdsConfig(token: string, patch: Partial<typeof this.adsConfig>, reason: string): typeof this.adsConfig {
    const admin = this.authorize(token, 'ads.manage');
    const before = { ...this.adsConfig };
    Object.assign(this.adsConfig, patch);
    this.audit(admin, 'ads.config.update', 'system', 'ads', { before, after: { ...this.adsConfig }, reason });
    return this.adsConfig;
  }

  // ─── Notifications ──────────────────────────────────────

  listNotificationTemplates(token: string) {
    this.authorize(token, 'notification.manage');
    return [...this.notificationTemplates];
  }

  // ─── Analytics ──────────────────────────────────────────

  getAnalytics(token: string) {
    this.authorize(token, 'analytics.read');
    return {
      funnels: {
        shareToCreate: { share: 1893, open: 1240, play: 890, complete: 620, create: 180, shareAgain: 95 },
        roomFlow: { create: 450, invite: 380, join: 290, start: 240, complete: 195 },
      },
      retention: { d1: 62, d7: 38, d30: 22 },
      engagement: { avgSessionMin: 12.4, quizzesPerUser: 3.2, gamesPerUser: 1.8 },
    };
  }

  getContentAnalytics(token: string) {
    this.authorize(token, 'analytics.read');
    return [
      { categoryId: 'cat-korku', name: 'Korku', contentCount: 312, completionRate: 0.78, skipRate: 0.08, reportRate: 0.01, quality: 87 },
      { categoryId: 'cat-18', name: '+18', contentCount: 298, completionRate: 0.65, skipRate: 0.12, reportRate: 0.04, quality: 82 },
    ];
  }

  // ─── Audit ──────────────────────────────────────────────

  listAuditLogs(token: string, filters: Parameters<typeof auditService.list>[0] = {}): { items: AuditLogEntry[]; total: number } {
    this.authorize(token, 'audit.read');
    return auditService.list(filters);
  }

  deleteAuditLogs(token: string, password: string): number {
    const admin = this.getAdminByToken(token);
    this.requireReauth(token, password);
    const count = auditService.deleteAll(admin.role);
    this.audit(admin, 'audit.delete_all', 'system', 'audit', { after: { deleted: count } });
    return count;
  }

  // ─── Feature Flags ──────────────────────────────────────

  listFeatureFlags(token: string): FeatureFlag[] {
    this.authorize(token, 'settings.update');
    return [...this.featureFlags];
  }

  updateFeatureFlag(token: string, key: string, enabled: boolean, reason: string, password?: string): FeatureFlag {
    const admin = this.authorize(token, 'feature_flag.update');
    if (['premium', 'adult_18'].includes(key)) this.requireReauth(token, password ?? '');
    const flag = this.featureFlags.find((f) => f.key === key);
    if (!flag) throw new Error('Flag not found');
    const before = { enabled: flag.enabled };
    flag.enabled = enabled;
    flag.updatedAt = new Date().toISOString();
    flag.updatedBy = admin.id;
    this.audit(admin, 'feature_flag.update', 'feature_flag', key, { before, after: { enabled }, reason });
    return flag;
  }

  // ─── System Health ──────────────────────────────────────

  getSystemHealth(token: string): SystemHealthCheck[] {
    this.authorize(token, 'settings.update');
    const checkedAt = new Date().toISOString();
    return [
      { service: 'API', status: 'PASS', message: 'Operational', checkedAt },
      { service: 'Database', status: 'PASS', message: 'Connected', checkedAt },
      { service: 'Realtime', status: 'PASS', message: 'WebSocket healthy', checkedAt },
      { service: 'Notifications', status: 'PASS', message: 'Queue processing', checkedAt },
      { service: 'AI Provider', status: 'WARNING', message: 'Elevated latency', checkedAt },
      { service: 'Payment Provider', status: 'PASS', message: 'Operational', checkedAt },
      { service: 'Ads Provider', status: 'PASS', message: 'Operational', checkedAt },
      { service: 'Storage', status: 'PASS', message: 'Available', checkedAt },
    ];
  }

  // ─── Category Constraints ───────────────────────────────

  validateCategoryUpdate(categoryId: string, patch: { isFree?: boolean; isActive?: boolean }): void {
    const FREE_IDS = ['cat-korku', 'cat-cesaret', 'cat-taniyorsun', 'cat-utandiran', 'cat-gece'];
    if (patch.isFree === false && FREE_IDS.includes(categoryId)) {
      throw new Error('Free categories cannot be changed to premium');
    }
    if (patch.isFree === true && !FREE_IDS.includes(categoryId)) {
      throw new Error('Premium categories cannot be changed to free');
    }
  }

  _resetForTests(): void {
    this.admins = SEED_ADMINS.map((a) => ({ ...a }));
    this.sessions.clear();
    this.users = seedUsers(120);
    this.rooms = seedRooms(this.users);
    this.games = seedGames(this.rooms);
    this.quizzes = seedQuizzes(this.users);
    this.reports = seedReports(this.users);
    this.tickets = seedSupport(this.users);
    this.subscriptions = seedSubscriptions(this.users);
    this.purchases = seedPurchases(this.users);
    this.featureFlags = SEED_FEATURE_FLAGS.map((f) => ({ ...f }));
    auditService._reset();
    sessionCounter = 0;
  }
}

export const adminPlatform = new AdminPlatform();
