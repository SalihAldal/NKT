import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId } from '../common/response.js';
import { prisma } from '../database/prisma.js';

const TEMPLATE_VARS = /^[a-zA-Z0-9_\-. ]+$/;

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key] ?? '';
    if (!TEMPLATE_VARS.test(value)) return '';
    return value.slice(0, 120);
  });
}

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const query = z.object({ page: z.coerce.number().default(1) }).parse(req.query);
    const pageSize = 20;
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId: req.userId! } }),
    ]);
    return ok({ items, total, page: query.page, pageSize, unreadCount: items.filter((n) => !n.readAt).length }, getRequestId(req));
  });

  app.post('/:id/read', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.notification.updateMany({ where: { id, userId: req.userId! }, data: { readAt: new Date() } });
    return ok({ read: true }, getRequestId(req));
  });

  app.post('/read-all', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    await prisma.notification.updateMany({ where: { userId: req.userId!, readAt: null }, data: { readAt: new Date() } });
    return ok({ readAll: true }, getRequestId(req));
  });

  app.post('/push-token', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const body = z.object({
      token: z.string().min(10),
      deviceId: z.string().min(1),
      platform: z.enum(['ios', 'android']),
      appVersion: z.string().optional(),
      locale: z.string().optional(),
      timezone: z.string().optional(),
    }).parse(req.body);

    await prisma.pushToken.upsert({
      where: { userId_deviceId: { userId: req.userId!, deviceId: body.deviceId } },
      create: {
        userId: req.userId!,
        deviceId: body.deviceId,
        platform: body.platform,
        token: body.token,
        active: true,
        lastSeen: new Date(),
      },
      update: { token: body.token, active: true, lastSeen: new Date(), platform: body.platform },
    });
    return ok({ registered: true }, getRequestId(req));
  });

  app.delete('/push-token', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const body = z.object({ deviceId: z.string().min(1) }).parse(req.body);
    await prisma.pushToken.updateMany({ where: { userId: req.userId!, deviceId: body.deviceId }, data: { active: false } });
    return ok({ unregistered: true }, getRequestId(req));
  });

  app.post('/send', { preHandler: authMiddleware }, async (req, reply) => {
    // Internal/admin-only — regular users cannot send arbitrary notifications
    return reply.status(403).send(fail('FORBIDDEN', 'Use admin API for notification dispatch', undefined, getRequestId(req)));
  });

  app.get('/templates', { preHandler: authMiddleware }, async (req: FastifyRequest) => {
    const templates = [
      { id: 'friend_request', title: '{{senderName}} arkadaşlık isteği gönderdi', body: 'İsteği görüntülemek için dokun.' },
      { id: 'room_invite', title: 'Odaya davet', body: 'Kod: {{roomCode}}' },
      { id: 'game_result', title: 'Oyun bitti', body: 'Sıralaman: {{rank}} — Skor: {{score}}' },
    ];
    return ok(templates.map((t) => ({
      ...t,
      preview: renderTemplate(t.body, { senderName: 'Ali', roomCode: 'ABC123', rank: '1', score: '120', categoryName: 'Korku' }),
    })), getRequestId(req));
  });
}
