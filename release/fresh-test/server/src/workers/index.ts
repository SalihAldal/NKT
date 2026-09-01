import { Queue, Worker, type Job } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../common/logger.js';
import { isRedisAvailable } from '../common/redis.js';
import { sendExpoPush } from '../providers/push/expo-push.provider.js';
import { processAiBatch } from '../ai/ai.routes.js';
import { prisma } from '../database/prisma.js';
import { getEntitlementForUser } from '../providers/payment/verification.provider.js';
import { expireEntitlement } from '../entitlements/entitlement.service.js';
import { logPaymentAudit } from '../entitlements/payment-audit.service.js';

const connection = { url: config.REDIS_URL };

let workerInstances: Worker[] = [];

export const notificationQueue = isRedisAvailable() ? new Queue('notifications', { connection }) : null;
export const pushQueue = isRedisAvailable() ? new Queue('push', { connection }) : null;
export const analyticsQueue = isRedisAvailable() ? new Queue('analytics', { connection }) : null;
export const cleanupQueue = isRedisAvailable() ? new Queue('cleanup', { connection }) : null;
export const aiQueue = isRedisAvailable() ? new Queue('ai', { connection }) : null;
export const moderationQueue = isRedisAvailable() ? new Queue('moderation', { connection }) : null;
export const subscriptionQueue = isRedisAvailable() ? new Queue('subscription', { connection }) : null;
export const badgeQueue = isRedisAvailable() ? new Queue('badge', { connection }) : null;
export const imageQueue = isRedisAvailable() ? new Queue('image', { connection }) : null;

async function processPushJob(job: Job) {
  const { notificationId, userId } = job.data as { notificationId: string; userId: string };
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return;

  const tokens = await prisma.pushToken.findMany({ where: { userId, active: true } });
  for (const t of tokens) {
    const result = await sendExpoPush({
      to: t.token,
      title: notification.title,
      body: notification.body,
      data: { type: notification.type, notificationId: notification.id },
    });
    if (result.invalidToken) {
      await prisma.pushToken.update({ where: { id: t.id }, data: { active: false } });
    }
  }
}

async function processSubscriptionReconciliation() {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'GRACE'] }, expiresAt: { lt: now } },
    take: 100,
  });
  for (const sub of subs) {
    await expireEntitlement(sub.userId, 'reconcile_expired');
    logPaymentAudit({ action: 'reconcile', userId: sub.userId, status: 'expired' });
  }
  logger.info({ count: subs.length }, 'Subscription reconciliation completed');
}

async function processBadgeJob(job: Job) {
  const { userId, event } = job.data as { userId: string; event: string };
  const badgeMap: Record<string, string> = {
    first_game: 'first-game',
    first_win: 'first-win',
    games_10: '10-games',
    games_50: '50-games',
    wins_10: '10-wins',
  };
  const slug = badgeMap[event];
  if (!slug) return;
  const badge = await prisma.badge.findFirst({ where: { id: slug } });
  if (!badge) return;
  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
    create: { userId, badgeId: badge.id },
    update: {},
  });
}

export function startWorkers() {
  if (!isRedisAvailable()) {
    logger.warn('Workers disabled — Redis unavailable');
    return;
  }

  const workers: Worker[] = [];

  workers.push(new Worker('notifications', async (job: Job) => {
    if (job.name === 'push') await processPushJob(job);
  }, { connection, concurrency: 5 }));

  workers.push(new Worker('push', async (job: Job) => processPushJob(job), { connection, concurrency: 5 }));

  workers.push(new Worker('analytics', async (job: Job) => {
    if (job.name === 'aggregate') {
      logger.debug({ jobId: job.id }, 'Aggregating analytics');
    }
  }, { connection, concurrency: 2 }));

  workers.push(new Worker('cleanup', async (job: Job) => {
    if (job.name === 'expired-rooms') {
      const { cleanupExpiredRooms } = await import('../realtime/disconnect-grace.js');
      await cleanupExpiredRooms();
      await prisma.room.updateMany({ where: { expiresAt: { lt: new Date() }, status: 'LOBBY' }, data: { status: 'EXPIRED' } });
    }
    if (job.name === 'stale-sessions') {
      await prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
    if (job.name === 'inactive-push-tokens') {
      const cutoff = new Date(Date.now() - 90 * 86400000);
      await prisma.pushToken.updateMany({ where: { lastSeen: { lt: cutoff } }, data: { active: false } });
    }
  }, { connection, concurrency: 1 }));

  workers.push(new Worker('ai', async (job: Job) => {
    const { batchId, categoryId, count, difficulty } = job.data as { batchId: string; categoryId: string; count: number; difficulty: string };
    await processAiBatch(batchId, categoryId, count, difficulty);
  }, { connection, concurrency: 2, limiter: { max: config.AI_RATE_LIMIT_PER_HOUR, duration: 3600000 } }));

  workers.push(new Worker('moderation', async (job: Job) => {
    if (job.name === 'report') {
      const { reportId } = job.data as { reportId: string };
      logger.info({ reportId }, 'Moderation report queued for review');
    }
  }, { connection, concurrency: 3 }));

  workers.push(new Worker('subscription', async (job: Job) => {
    if (job.name === 'reconcile') await processSubscriptionReconciliation();
  }, { connection, concurrency: 1 }));

  workers.push(new Worker('badge', async (job: Job) => processBadgeJob(job), { connection, concurrency: 3 }));

  workers.push(new Worker('image', async (job: Job) => {
    logger.debug({ jobId: job.id }, 'Image processing job');
  }, { connection, concurrency: 2 }));

  workerInstances = workers;

  cleanupQueue?.add('expired-rooms', {}, { repeat: { every: 3600000 } });
  cleanupQueue?.add('stale-sessions', {}, { repeat: { every: 86400000 } });
  cleanupQueue?.add('inactive-push-tokens', {}, { repeat: { every: 86400000 } });
  subscriptionQueue?.add('reconcile', {}, { repeat: { every: 3600000 } });

  logger.info({ count: workers.length }, 'Workers started');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workerInstances.map((w) => w.close()));
  workerInstances = [];
  logger.info('Workers stopped');
}

// Standalone worker entry (dev)
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  import('../database/prisma.js').then(({ connectDatabase }) => connectDatabase()).then(() => {
    import('../common/redis.js').then(({ connectRedis }) => connectRedis()).then(() => startWorkers());
  });
}
