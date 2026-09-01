import type { FastifyInstance } from 'fastify';
import { prisma } from '../database/prisma.js';
import { isRedisAvailable } from '../common/redis.js';
import { ok, getRequestId } from '../common/response.js';
import { config } from '../config/index.js';
import { paymentBreaker, pushBreaker, aiBreaker, storageBreaker } from '../common/circuit-breaker.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (req) => ok({ status: 'ok', timestamp: new Date().toISOString(), env: config.NODE_ENV }, getRequestId(req)));

  app.get('/health/live', async (req) => ok({ alive: true }, getRequestId(req)));

  app.get('/health/ready', async (req, reply) => {
    const checks: Record<string, string> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'PASS';
    } catch {
      checks.database = 'FAIL';
    }
    const redisOk = isRedisAvailable();
    checks.redis = redisOk ? 'PASS' : (config.isProduction ? 'FAIL' : 'WARNING');
    checks.realtime = 'PASS';
    checks.queues = redisOk ? 'PASS' : (config.isProduction ? 'FAIL' : 'WARNING');
    checks.push = config.EXPO_ACCESS_TOKEN ? 'CONFIGURED' : 'NOT_CONFIGURED';
    checks.storage = config.STORAGE_PROVIDER;
    checks.payment = config.APPLE_SHARED_SECRET || config.GOOGLE_SERVICE_ACCOUNT_JSON ? 'CONFIGURED' : 'SANDBOX';
    checks.ai = aiBreaker.getState();
    checks.circuits = JSON.stringify({
      payment: paymentBreaker.getState(),
      push: pushBreaker.getState(),
      storage: storageBreaker.getState(),
    });
    const allPass = checks.database === 'PASS' && checks.redis !== 'FAIL' && checks.queues !== 'FAIL';
    return reply.status(allPass ? 200 : 503).send(ok({ checks, ready: allPass }, getRequestId(req)));
  });

  app.get('/api/v1/config/app', async (req) => ok({
    minSupportedVersion: config.MIN_APP_VERSION,
    environment: config.NODE_ENV,
  }, getRequestId(req)));
}
