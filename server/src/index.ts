import { createServer, type Server as HttpServer } from 'http';
import { buildApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/prisma.js';
import { connectRedis, disconnectRedis } from './common/redis.js';
import { setupRealtime, startRealtimeOnly, initRealtimeEmitter, closeRealtime } from './realtime/socket.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { startMiniHealthServer } from './health/mini-health.js';
import { logger } from './common/logger.js';

let httpServer: HttpServer | null = null;
let healthServer: HttpServer | null = null;
let shuttingDown = false;

async function startApi() {
  const app = await buildApp();
  httpServer = createServer((req, res) => {
    app.server.emit('request', req, res);
  });
  initRealtimeEmitter();
  await app.ready();
  await new Promise<void>((resolve) => {
    httpServer!.listen(config.PORT, config.HOST, () => {
      logger.info({ role: 'api', port: config.PORT }, 'NKT API listening');
      resolve();
    });
  });
  return app;
}

async function startRealtime() {
  httpServer = createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/health')) {
      const { isRedisAvailable } = await import('./common/redis.js');
      const { prisma } = await import('./database/prisma.js');
      res.setHeader('Content-Type', 'application/json');
      if (url === '/health/live') {
        res.writeHead(200);
        res.end(JSON.stringify({ alive: true, service: 'realtime' }));
        return;
      }
      const checks: Record<string, string> = { service: 'realtime' };
      try { await prisma.$queryRaw`SELECT 1`; checks.database = 'PASS'; } catch { checks.database = 'FAIL'; }
      checks.redis = isRedisAvailable() ? 'PASS' : 'FAIL';
      const ready = checks.database === 'PASS' && checks.redis === 'PASS';
      res.writeHead(ready ? 200 : 503);
      res.end(JSON.stringify({ checks, ready }));
      return;
    }
  });
  await startRealtimeOnly(httpServer);
  await new Promise<void>((resolve) => {
    httpServer!.listen(config.REALTIME_PORT, config.HOST, () => {
      logger.info({ role: 'realtime', port: config.REALTIME_PORT }, 'NKT Realtime listening');
      resolve();
    });
  });
}

async function startAll() {
  const app = await buildApp();
  httpServer = createServer((req, res) => {
    app.server.emit('request', req, res);
  });
  await setupRealtime(httpServer);
  startWorkers();
  await app.ready();
  await new Promise<void>((resolve) => {
    httpServer!.listen(config.PORT, config.HOST, () => {
      logger.info({ role: 'all', port: config.PORT }, 'NKT API+Realtime listening');
      resolve();
    });
  });
  return app;
}

const SHUTDOWN_TIMEOUT_MS = 25_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} shutdown timeout`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function shutdown(signal: string, app?: Awaited<ReturnType<typeof buildApp>>) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  try {
    await withTimeout(stopWorkers(), SHUTDOWN_TIMEOUT_MS, 'workers');
    await withTimeout(closeRealtime(), SHUTDOWN_TIMEOUT_MS, 'realtime');

    if (httpServer) {
      await withTimeout(new Promise<void>((resolve) => httpServer!.close(() => resolve())), SHUTDOWN_TIMEOUT_MS, 'http');
      httpServer = null;
    }
    if (healthServer) {
      await withTimeout(new Promise<void>((resolve) => healthServer!.close(() => resolve())), SHUTDOWN_TIMEOUT_MS, 'health');
      healthServer = null;
    }
    if (app) await withTimeout(app.close(), SHUTDOWN_TIMEOUT_MS, 'fastify');
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Shutdown error — forcing exit');
    process.exit(1);
  }
}

async function main() {
  await connectDatabase();
  await connectRedis();

  const role = config.SERVICE_ROLE;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  if (role === 'api') {
    app = await startApi();
  } else if (role === 'realtime') {
    await startRealtime();
  } else if (role === 'worker') {
    healthServer = startMiniHealthServer(config.WORKER_HEALTH_PORT, 'worker');
    startWorkers();
    logger.info({ role: 'worker' }, 'NKT Workers started');
  } else {
    app = await startAll();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM', app));
  process.on('SIGINT', () => shutdown('SIGINT', app));
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
