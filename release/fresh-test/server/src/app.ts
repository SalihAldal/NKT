import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { logger } from './common/logger.js';
import { AppError, fail, getRequestId } from './common/response.js';
import { authRoutes } from './auth/auth.routes.js';
import { roomRoutes, gameRoutes } from './rooms/room.routes.js';
import { healthRoutes } from './health/health.routes.js';
import { userRoutes } from './users/user.routes.js';
import { quizRoutes } from './quizzes/quiz.routes.js';
import { friendRoutes } from './friends/friend.routes.js';
import { contentRoutes } from './content/content.routes.js';
import { adminRoutes } from './admin/admin.routes.js';
import { analyticsRoutes } from './analytics/analytics.routes.js';
import { webhookRoutes } from './payments/webhook.routes.js';
import { subscriptionRoutes } from './subscriptions/subscription.routes.js';
import { notificationRoutes } from './notifications/notification.routes.js';
import { storageRoutes } from './storage/storage.routes.js';
import { rewardRoutes } from './rewards/reward.routes.js';
import { aiRoutes } from './ai/ai.routes.js';
import { reportRoutes } from './reports/report.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  app.addHook('onRequest', async (req) => {
    req.log = logger.child({ requestId: req.id });
  });

  app.addHook('onResponse', async (req, reply) => {
    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    });
  });

  app.setErrorHandler((err, req, reply) => {
    const requestId = getRequestId(req);
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(fail(err.code, err.message, err.details, requestId));
    }
    logger.error({ err, requestId }, 'Unhandled error');
    return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error', undefined, requestId));
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(quizRoutes, { prefix: '/api/v1/quizzes' });
  await app.register(friendRoutes, { prefix: '/api/v1/friends' });
  await app.register(roomRoutes, { prefix: '/api/v1/rooms' });
  await app.register(gameRoutes, { prefix: '/api/v1/games' });
  await app.register(contentRoutes, { prefix: '/api/v1/content' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await app.register(storageRoutes, { prefix: '/api/v1/storage' });
  await app.register(rewardRoutes, { prefix: '/api/v1/rewards' });
  await app.register(aiRoutes, { prefix: '/api/v1/ai' });
  await app.register(reportRoutes, { prefix: '/api/v1/reports' });

  return app;
}
