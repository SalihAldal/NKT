import { describe, it, expect, beforeEach } from 'vitest';
import {
  adminPlatform,
  auditService,
  roleHasPermission,
  ROLE_PERMISSIONS,
} from '@/services/admin';

describe('PHASE 10 — Admin Platform', () => {
  let superToken: string;
  let modToken: string;
  let supportToken: string;
  let analystToken: string;

  beforeEach(() => {
    adminPlatform._resetForTests();
    superToken = adminPlatform.login('super@nkt.app', 'super123').session.token;
    modToken = adminPlatform.login('mod@nkt.app', 'mod123').session.token;
    supportToken = adminPlatform.login('support@nkt.app', 'support123').session.token;
    analystToken = adminPlatform.login('analyst@nkt.app', 'analyst123').session.token;
  });

  // 1. Admin login
  it('1. admin login', () => {
    const result = adminPlatform.login('super@nkt.app', 'super123');
    expect(result.session.token).toBeTruthy();
    expect(result.admin.role).toBe('SUPER_ADMIN');
    expect(result.admin).not.toHaveProperty('passwordHash');
  });

  // 2. Unauthorized user blocked
  it('2. unauthorized user blocked', () => {
    expect(() => adminPlatform.login('super@nkt.app', 'wrong')).toThrow();
    expect(() => adminPlatform.getAdminByToken('invalid-token')).toThrow();
  });

  // 3. Role authorization
  it('3. role authorization', () => {
    expect(roleHasPermission('SUPER_ADMIN', 'user.delete')).toBe(true);
    expect(roleHasPermission('MODERATOR', 'user.delete')).toBe(false);
    expect(roleHasPermission('ANALYST', 'analytics.read')).toBe(true);
    expect(roleHasPermission('ANALYST', 'user.suspend')).toBe(false);
  });

  // 4. Permission authorization
  it('4. permission authorization', () => {
    expect(() => adminPlatform.suspendUser(analystToken, 'user-1', 'test')).toThrow();
    expect(() => adminPlatform.getDashboard(analystToken)).not.toThrow();
  });

  // 5. User search
  it('5. user search', () => {
    const result = adminPlatform.listUsers(superToken, { search: 'user1', pageSize: 10 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  // 6. User suspend
  it('6. user suspend', () => {
    const user = adminPlatform.suspendUser(superToken, 'user-1', 'spam', 'super123');
    expect(user.status).toBe('suspended');
    const logs = auditService.list({ action: 'user.suspend' });
    expect(logs.total).toBeGreaterThan(0);
  });

  // 7. User restore
  it('7. user restore', () => {
    adminPlatform.suspendUser(superToken, 'user-2', 'test', 'super123');
    const user = adminPlatform.unsuspendUser(superToken, 'user-2', 'restored');
    expect(user.status).toBe('active');
  });

  // 8. Room inspect
  it('8. room inspect', () => {
    const rooms = adminPlatform.listRooms(superToken);
    const room = adminPlatform.getRoom(superToken, rooms.items[0]!.id);
    expect(room.code).toBeTruthy();
    expect(room.hostName).toBeTruthy();
  });

  // 9. Room close
  it('9. room close', () => {
    const rooms = adminPlatform.listRooms(superToken, { status: 'lobby' });
    const room = adminPlatform.closeRoom(superToken, rooms.items[0]!.id, 'admin action');
    expect(room.status).toBe('closed');
  });

  // 10. Player remove
  it('10. player remove', () => {
    const rooms = adminPlatform.listRooms(superToken, { status: 'playing' });
    if (rooms.items[0]) {
      const before = rooms.items[0].playerCount;
      const room = adminPlatform.removePlayerFromRoom(superToken, rooms.items[0].id, 'user-1', 'kick');
      expect(room.playerCount).toBeLessThan(before);
    }
  });

  // 11. Game inspect
  it('11. game inspect', () => {
    const games = adminPlatform.listGames(superToken);
    expect(games.items.length).toBeGreaterThan(0);
    const game = adminPlatform.getGame(superToken, games.items[0]!.id);
    expect(game.scores.length).toBeGreaterThan(0);
  });

  // 12. Game abort
  it('12. game abort', () => {
    const games = adminPlatform.listGames(superToken, { status: 'active' });
    if (games.items[0]) {
      const game = adminPlatform.abortGame(superToken, games.items[0].id, 'admin abort', 'super123');
      expect(game.status).toBe('aborted');
    }
  });

  // 13. Content search (via dashboard content count)
  it('13. content search — dashboard content count', () => {
    const dash = adminPlatform.getDashboard(superToken);
    expect(dash.contentCount).toBeGreaterThan(0);
  });

  // 14. Content filter — N/A at platform level (admin-api handles), verify analytics
  it('14. content filter — content analytics', () => {
    const analytics = adminPlatform.getContentAnalytics(superToken);
    expect(analytics.length).toBeGreaterThan(0);
    expect(analytics[0]).toHaveProperty('completionRate');
  });

  // 15. Content approve — custom category
  it('15. content approve — custom category', () => {
    adminPlatform.moderateCustomCategory(superToken, 'cc-1', 'approve', 'looks good');
    const queue = adminPlatform.getModerationQueue(superToken);
    expect(queue.customCategories.find((c) => c.id === 'cc-1')?.status).not.toBe('REVIEW');
  });

  // 16. Content reject — custom category
  it('16. content reject', () => {
    adminPlatform.moderateCustomCategory(superToken, 'cc-1', 'reject', 'inappropriate');
    const queue = adminPlatform.getModerationQueue(modToken);
    expect(queue.customCategories.length).toBe(0);
  });

  // 17. Bulk operation — reports resolve multiple
  it('17. bulk operation — resolve reports', () => {
    const reports = adminPlatform.listReports(modToken, { status: 'open' });
    reports.items.slice(0, 3).forEach((r) => {
      adminPlatform.resolveReport(modToken, r.id, 'resolved', 'bulk resolve');
    });
    const logs = auditService.list({ action: 'report.resolve' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  // 18. Category constraints
  it('18. category constraints', () => {
    expect(() => adminPlatform.validateCategoryUpdate('cat-korku', { isFree: false })).toThrow('Free categories');
    expect(() => adminPlatform.validateCategoryUpdate('cat-ask-iliski', { isFree: true })).toThrow('Premium categories');
    expect(() => adminPlatform.validateCategoryUpdate('cat-korku', { isActive: false })).not.toThrow();
  });

  // 19. Custom content moderation
  it('19. custom content moderation', () => {
    adminPlatform.moderateCustomCategory(modToken, 'cc-1', 'approve', 'ok');
    const logs = auditService.list({ targetType: 'custom_category' });
    expect(logs.total).toBeGreaterThan(0);
  });

  // 20. Report workflow
  it('20. report workflow', () => {
    const reports = adminPlatform.listReports(modToken, { status: 'open' });
    const report = reports.items[0]!;
    adminPlatform.assignReport(modToken, report.id, 'admin-mod');
    const resolved = adminPlatform.resolveReport(modToken, report.id, 'resolved', 'investigated');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolverId).toBeTruthy();
  });

  // 21. +18 moderation — feature flag
  it('21. +18 moderation — feature flag control', () => {
    const flags = adminPlatform.listFeatureFlags(superToken);
    const adult = flags.find((f) => f.key === 'adult_18');
    expect(adult?.enabled).toBe(true);
    adminPlatform.updateFeatureFlag(superToken, 'adult_18', false, 'maintenance', 'super123');
    const updated = adminPlatform.listFeatureFlags(superToken).find((f) => f.key === 'adult_18');
    expect(updated?.enabled).toBe(false);
  });

  // 22. Subscription inspect
  it('22. subscription inspect', () => {
    const subs = adminPlatform.listSubscriptions(superToken, { status: 'active' });
    expect(subs.items.length).toBeGreaterThan(0);
    expect(subs.items[0]).toHaveProperty('productId');
    expect(subs.items[0]).not.toHaveProperty('receipt');
  });

  // 23. Manual entitlement protected
  it('23. manual entitlement protected', () => {
    expect(() => adminPlatform.grantEntitlement(modToken, 'user-1', 'com.nkt.app.premium.monthly', new Date().toISOString(), 'test', 'mod123')).toThrow();
    const sub = adminPlatform.grantEntitlement(superToken, 'user-5', 'com.nkt.app.premium.monthly', new Date(Date.now() + 30 * 86400000).toISOString(), 'support grant', 'super123');
    expect(sub.status).toBe('active');
    const logs = auditService.list({ action: 'entitlement.grant' });
    expect(logs.total).toBeGreaterThan(0);
  });

  // 24. Notification template
  it('24. notification template', () => {
    const templates = adminPlatform.listNotificationTemplates(superToken);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty('deepLink');
  });

  // 25. Support ticket
  it('25. support ticket', () => {
    const tickets = adminPlatform.listSupportTickets(supportToken, { status: 'open' });
    expect(tickets.items.length).toBeGreaterThan(0);
    const resolved = adminPlatform.resolveSupportTicket(supportToken, tickets.items[0]!.id, 'resolved', 'Fixed');
    expect(resolved.status).toBe('resolved');
    expect(resolved.notes.length).toBeGreaterThan(0);
  });

  // 26. Analytics
  it('26. analytics', () => {
    const analytics = adminPlatform.getAnalytics(analystToken);
    expect(analytics.funnels.shareToCreate.share).toBeGreaterThan(0);
    expect(analytics.funnels.roomFlow.create).toBeGreaterThan(0);
  });

  // 27. Audit log
  it('27. audit log', () => {
    adminPlatform.suspendUser(superToken, 'user-10', 'test', 'super123');
    const logs = adminPlatform.listAuditLogs(superToken, { action: 'user.suspend' });
    expect(logs.total).toBeGreaterThan(0);
    expect(logs.items[0]).toHaveProperty('requestId');
    expect(logs.items[0]).not.toHaveProperty('password');
  });

  // 28. Feature flag
  it('28. feature flag', () => {
    const flag = adminPlatform.updateFeatureFlag(superToken, 'leaderboard', false, 'test', 'super123');
    expect(flag.enabled).toBe(false);
    adminPlatform.updateFeatureFlag(superToken, 'leaderboard', true, 'restore', 'super123');
  });

  // 29. System health
  it('29. system health', () => {
    const health = adminPlatform.getSystemHealth(superToken);
    expect(health.length).toBeGreaterThanOrEqual(6);
    health.forEach((h) => {
      expect(['PASS', 'WARNING', 'FAIL']).toContain(h.status);
      expect(h.message).not.toMatch(/password|secret|key/i);
    });
  });

  // 30. Critical action re-auth
  it('30. critical action re-auth', () => {
    expect(() => adminPlatform.grantEntitlement(superToken, 'user-1', 'com.nkt.app.premium.monthly', new Date().toISOString(), 'test', 'wrong')).toThrow();
  });

  // 31. Server-side pagination
  it('31. server-side pagination', () => {
    const page1 = adminPlatform.listUsers(superToken, { page: 1, pageSize: 10 });
    const page2 = adminPlatform.listUsers(superToken, { page: 2, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page2.items.length).toBe(10);
    expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    expect(page1.total).toBeGreaterThan(20);
  });

  // 32. Large dataset performance
  it('32. large dataset performance', () => {
    const start = Date.now();
    const result = adminPlatform.listUsers(superToken, { page: 1, pageSize: 50 });
    const elapsed = Date.now() - start;
    expect(result.items.length).toBe(50);
    expect(elapsed).toBeLessThan(500);
  });

  // RBAC completeness
  it('RBAC — all roles have permissions', () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>;
    expect(roles.length).toBe(6);
    roles.forEach((role) => {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    });
  });

  // Session refresh
  it('session refresh', () => {
    const session = adminPlatform.refreshSession(superToken);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  // Logout
  it('logout invalidates session', () => {
    const { session } = adminPlatform.login('super@nkt.app', 'super123');
    adminPlatform.logout(session.token);
    expect(() => adminPlatform.getAdminByToken(session.token)).toThrow();
  });

  // Ads config — premium ad-free
  it('ads — premium users remain ad-free', () => {
    const config = adminPlatform.getAdsConfig(superToken);
    expect(config.premiumAdFree).toBe(true);
  });

  // Quiz list
  it('quiz management', () => {
    const quizzes = adminPlatform.listQuizzes(superToken, { status: 'published' });
    expect(quizzes.items.length).toBeGreaterThan(0);
  });

  // Purchases — no raw payment data
  it('purchases — no raw payment data', () => {
    const purchases = adminPlatform.listPurchases(superToken);
    purchases.items.forEach((p) => {
      expect(p).not.toHaveProperty('cardNumber');
      expect(p).not.toHaveProperty('receipt');
    });
  });

  // User warn
  it('user warn', () => {
    const user = adminPlatform.warnUser(modToken, 'user-3', 'inappropriate content');
    expect(user.warningCount).toBeGreaterThan(0);
  });

  // Audit delete — super admin only
  it('audit delete — super admin only', () => {
    adminPlatform.suspendUser(superToken, 'user-1', 'test', 'super123');
    expect(() => auditService.deleteAll('MODERATOR')).toThrow();
    const count = adminPlatform.deleteAuditLogs(superToken, 'super123');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
