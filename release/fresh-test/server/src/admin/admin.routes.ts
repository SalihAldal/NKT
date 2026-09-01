import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { ok, fail, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { adminAuth, requireAdminRole } from './admin-auth.js';
import * as adminService from './admin.service.js';
import { writeAuditLog } from './admin.service.js';
import { mapRoomToDto } from '../rooms/room.service.js';

const pageQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
});

export async function adminRoutes(app: FastifyInstance) {
  // ─── Auth ───────────────────────────────────────────────
  app.post('/auth/login', async (req, reply) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
      return reply.status(401).send(fail('INVALID_CREDENTIALS', 'Invalid credentials', undefined, getRequestId(req)));
    }
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await prisma.adminSession.create({ data: { adminId: admin.id, token, expiresAt } });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return ok({ token, admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role } }, getRequestId(req));
  });

  app.post('/auth/logout', async (req) => {
    const admin = await adminAuth(req);
    const token = req.headers.authorization?.slice(7);
    if (token) await prisma.adminSession.deleteMany({ where: { token } });
    await writeAuditLog({ adminId: admin.id, action: 'auth.logout', targetType: 'admin', targetId: admin.id, requestId: getRequestId(req) });
    return ok({ loggedOut: true }, getRequestId(req));
  });

  app.get('/auth/me', async (req) => {
    const admin = await adminAuth(req);
    return ok({ id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role }, getRequestId(req));
  });

  // ─── Dashboard ──────────────────────────────────────────
  app.get('/dashboard', async (req) => {
    await adminAuth(req);
    const { range } = z.object({ range: z.enum(['today', '7d', '30d', '90d']).default('7d') }).parse(req.query);
    const stats = await adminService.getDashboardStats(range);
    return ok(stats, getRequestId(req));
  });

  // ─── Users ──────────────────────────────────────────────
  app.get('/users', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.extend({ search: z.string().optional(), status: z.string().optional() }).parse(req.query);
    const result = await adminService.listUsers(query);
    return ok(result, getRequestId(req));
  });

  app.get('/users/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const { id } = req.params as { id: string };
    const user = await adminService.getUserDetail(id);
    if (!user) throw ERR.NOT_FOUND;
    return ok(user, getRequestId(req));
  });

  app.post('/users/:id/suspend', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw ERR.NOT_FOUND;
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await writeAuditLog({ adminId: admin.id, action: 'user.suspend', targetType: 'user', targetId: id, reason, before: { status: before.status }, after: { status: 'SUSPENDED' }, requestId: getRequestId(req) });
    return ok({ suspended: true }, getRequestId(req));
  });

  app.post('/users/:id/unsuspend', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    await writeAuditLog({ adminId: admin.id, action: 'user.unsuspend', targetType: 'user', targetId: id, reason, requestId: getRequestId(req) });
    return ok({ unsuspended: true }, getRequestId(req));
  });

  // ─── Categories ───────────────────────────────────────
  app.get('/categories', async (req) => {
    await adminAuth(req);
    const categories = await adminService.listCategoriesWithCounts();
    return ok(categories, getRequestId(req));
  });

  app.patch('/categories/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const { id } = req.params as { id: string };
    const patch = z.object({ isActive: z.boolean().optional(), order: z.number().optional() }).parse(req.body);
    const updated = await prisma.category.update({ where: { id }, data: patch });
    await writeAuditLog({ adminId: admin.id, action: 'category.update', targetType: 'category', targetId: id, after: patch, requestId: getRequestId(req) });
    const categories = await adminService.listCategoriesWithCounts();
    const cat = categories.find((c) => c.id === id);
    return ok(cat ?? updated, getRequestId(req));
  });

  // ─── Content ──────────────────────────────────────────
  app.get('/content', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const query = pageQuery.extend({
      categoryId: z.string().optional(),
      search: z.string().optional(),
      type: z.string().optional(),
      difficulty: z.coerce.number().optional(),
      premium: z.coerce.boolean().optional(),
      active: z.coerce.boolean().optional(),
      moderationStatus: z.string().optional(),
      reviewQueue: z.coerce.boolean().optional(),
    }).parse(req.query);
    const result = await adminService.listContent(query);
    return ok(result, getRequestId(req));
  });

  app.get('/content/review-queue', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const query = pageQuery.extend({ categoryId: z.string().optional() }).parse(req.query);
    const result = await adminService.listContent({ ...query, reviewQueue: true });
    return ok(result, getRequestId(req));
  });

  app.patch('/content/:id/moderate', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { action } = z.object({ action: z.enum(['approve', 'reject', 'hide']) }).parse(req.body);
    const result = await adminService.moderateContent(admin.id, id, action, getRequestId(req));
    if (!result) throw ERR.NOT_FOUND;
    return ok(result, getRequestId(req));
  });

  app.post('/content/bulk-moderate', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { ids, action } = z.object({ ids: z.array(z.string()), action: z.enum(['approve', 'reject', 'hide']) }).parse(req.body);
    let success = 0;
    let skipped = 0;
    for (const id of ids) {
      const result = await adminService.moderateContent(admin.id, id, action, getRequestId(req));
      if (result) success++;
      else skipped++;
    }
    return ok({ success, skipped }, getRequestId(req));
  });

  app.patch('/content/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const { id } = req.params as { id: string };
    const patch = z.object({
      prompt: z.string().optional(),
      active: z.boolean().optional(),
      premium: z.boolean().optional(),
      difficulty: z.number().min(1).max(3).optional(),
    }).parse(req.body);
    const updated = await prisma.gameContent.update({ where: { id }, data: patch });
    await writeAuditLog({ adminId: admin.id, action: 'content.update', targetType: 'content', targetId: id, after: patch, requestId: getRequestId(req) });
    return ok(updated, getRequestId(req));
  });

  app.delete('/content/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const { id } = req.params as { id: string };
    await prisma.gameContent.update({ where: { id }, data: { active: false, moderationStatus: 'DISABLED' } });
    await writeAuditLog({ adminId: admin.id, action: 'content.delete', targetType: 'content', targetId: id, requestId: getRequestId(req) });
    return ok({ deleted: true }, getRequestId(req));
  });

  // ─── Rooms ────────────────────────────────────────────
  app.get('/rooms', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const result = await adminService.listRooms(query);
    return ok(result, getRequestId(req));
  });

  app.get('/rooms/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const { id } = req.params as { id: string };
    const room = await adminService.getRoomDetail(id);
    if (!room) throw ERR.NOT_FOUND;
    return ok({ ...mapRoomToDto(room), games: room.games }, getRequestId(req));
  });

  app.post('/rooms/:id/close', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    await prisma.room.update({ where: { id }, data: { status: 'CLOSED' } });
    await writeAuditLog({ adminId: admin.id, action: 'room.close', targetType: 'room', targetId: id, reason, requestId: getRequestId(req) });
    return ok({ closed: true }, getRequestId(req));
  });

  // ─── Games ────────────────────────────────────────────
  app.get('/games', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const result = await adminService.listGames(query);
    return ok(result, getRequestId(req));
  });

  app.get('/games/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const { id } = req.params as { id: string };
    const game = await adminService.getGameDetail(id);
    if (!game) throw ERR.NOT_FOUND;
    return ok(game, getRequestId(req));
  });

  // ─── Reports ──────────────────────────────────────────
  app.get('/reports', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const query = pageQuery.extend({ status: z.string().optional(), priority: z.string().optional() }).parse(req.query);
    const result = await adminService.listReports(query);
    return ok(result, getRequestId(req));
  });

  app.post('/reports/:id/resolve', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { status, reason } = z.object({ status: z.enum(['resolved', 'rejected', 'escalated']), reason: z.string().min(1) }).parse(req.body);
    const statusMap = { resolved: 'RESOLVED', rejected: 'REJECTED', escalated: 'ESCALATED' } as const;
    const updated = await prisma.report.update({
      where: { id },
      data: { status: statusMap[status], resolvedAt: new Date() },
    });
    await prisma.moderationAction.create({
      data: { adminId: admin.id, action: `report.${status}`, targetType: 'report', targetId: id, reason },
    });
    await writeAuditLog({ adminId: admin.id, action: `report.${status}`, targetType: 'report', targetId: id, reason, requestId: getRequestId(req) });
    return ok(updated, getRequestId(req));
  });

  // ─── Payments ─────────────────────────────────────────
  app.get('/purchases', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const query = pageQuery.extend({ state: z.string().optional() }).parse(req.query);
    const result = await adminService.listPurchases(query);
    return ok(result, getRequestId(req));
  });

  app.get('/subscriptions', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const query = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const result = await adminService.listSubscriptions(query);
    return ok(result, getRequestId(req));
  });

  app.get('/revenue', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const stats = await adminService.getRevenueStats();
    return ok(stats, getRequestId(req));
  });

  // ─── Notifications ────────────────────────────────────
  app.get('/notifications', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.parse(req.query);
    const result = await adminService.listNotifications(query);
    return ok(result, getRequestId(req));
  });

  app.post('/notifications/send', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ADMIN');
    const body = z.object({
      userId: z.string().uuid(),
      type: z.enum(['SYSTEM', 'MARKETING', 'PREMIUM']),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(500),
    }).parse(req.body);
    const notification = await prisma.notification.create({
      data: { userId: body.userId, type: body.type, title: body.title, body: body.body },
    });
    await writeAuditLog({ adminId: admin.id, action: 'notification.send', targetType: 'user', targetId: body.userId, after: { title: body.title }, requestId: getRequestId(req) });
    return ok(notification, getRequestId(req));
  });

  // ─── Analytics ────────────────────────────────────────
  app.get('/analytics', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const { range } = z.object({ range: z.enum(['today', '7d', '30d', '90d']).default('7d') }).parse(req.query);
    const stats = await adminService.getAnalytics(range);
    return ok(stats, getRequestId(req));
  });

  // ─── Support ──────────────────────────────────────────
  app.get('/support/tickets', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const result = await adminService.listSupportTickets(query);
    return ok(result, getRequestId(req));
  });

  app.post('/support/tickets/:id/resolve', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const { id } = req.params as { id: string };
    const { status, note } = z.object({ status: z.enum(['resolved', 'closed']), note: z.string().optional() }).parse(req.body);
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status: status.toUpperCase() as 'RESOLVED' | 'CLOSED' },
    });
    await writeAuditLog({ adminId: admin.id, action: 'support.resolve', targetType: 'ticket', targetId: id, reason: note, requestId: getRequestId(req) });
    return ok(updated, getRequestId(req));
  });

  // ─── System ───────────────────────────────────────────
  app.get('/system/health', async (req) => {
    await adminAuth(req);
    const checks = await adminService.getSystemHealth();
    return ok(checks, getRequestId(req));
  });

  app.get('/system/feature-flags', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ADMIN');
    const flags = await adminService.listFeatureFlags();
    return ok(flags, getRequestId(req));
  });

  app.patch('/system/feature-flags/:key', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPER_ADMIN');
    const { key } = req.params as { key: string };
    const { enabled, reason } = z.object({ enabled: z.boolean(), reason: z.string().optional() }).parse(req.body);
    const updated = await prisma.featureFlag.update({ where: { key }, data: { enabled, updatedBy: admin.id } });
    await writeAuditLog({ adminId: admin.id, action: 'feature_flag.update', targetType: 'feature_flag', targetId: key, after: { enabled }, reason, requestId: getRequestId(req) });
    return ok(updated, getRequestId(req));
  });

  // ─── Quizzes ──────────────────────────────────────────
  app.get('/quizzes', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'SUPPORT');
    const query = pageQuery.extend({ search: z.string().optional(), status: z.string().optional() }).parse(req.query);
    const result = await adminService.listQuizzes(query);
    return ok(result, getRequestId(req));
  });

  // ─── Social ───────────────────────────────────────────
  app.get('/social/stats', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const stats = await adminService.getSocialStats();
    return ok(stats, getRequestId(req));
  });

  // ─── Content analytics ──────────────────────────────────
  app.get('/analytics/content', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const stats = await adminService.getContentAnalytics();
    return ok(stats, getRequestId(req));
  });

  // ─── Moderation queue ───────────────────────────────────
  app.get('/moderation/queue', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const queue = await adminService.listModerationQueue();
    return ok(queue, getRequestId(req));
  });

  app.post('/moderation/custom-categories/:id', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'MODERATOR');
    const { id } = req.params as { id: string };
    const { action } = z.object({ action: z.enum(['approve', 'reject']) }).parse(req.body);
    const result = await adminService.moderateCustomCategory(admin.id, id, action, getRequestId(req));
    return ok(result, getRequestId(req));
  });

  // ─── Content batches ────────────────────────────────────
  app.get('/content/batches', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'CONTENT_MANAGER');
    const batches = await adminService.listContentBatches();
    return ok(batches, getRequestId(req));
  });

  // ─── Subscriptions (list alias) ─────────────────────────
  app.get('/subscriptions/list', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const query = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const result = await adminService.listSubscriptions(query);
    return ok(result, getRequestId(req));
  });

  // ─── Audit ────────────────────────────────────────────
  app.get('/audit-logs', async (req) => {
    const admin = await adminAuth(req);
    requireAdminRole(admin, 'ANALYST');
    const { page = 1, pageSize = 50, action, targetType } = pageQuery.extend({
      action: z.string().optional(),
      targetType: z.string().optional(),
    }).parse(req.query);
    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action };
    if (targetType) where.targetType = targetType;
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { email: true, displayName: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok({
      items: items.map((l) => ({
        id: l.id,
        adminId: l.adminId,
        adminEmail: l.admin.email,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        reason: l.reason,
        timestamp: l.createdAt.toISOString(),
        requestId: l.requestId,
      })),
      ...adminService.paginationMeta(total, page, pageSize),
    }, getRequestId(req));
  });
}
