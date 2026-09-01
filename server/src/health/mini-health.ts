import { createServer, type Server } from 'http';
import { prisma } from '../database/prisma.js';
import { isRedisAvailable } from '../common/redis.js';
import { config } from '../config/index.js';

export function startMiniHealthServer(port: number, service: string): Server {
  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';
    res.setHeader('Content-Type', 'application/json');

    if (url === '/health/live') {
      res.writeHead(200);
      res.end(JSON.stringify({ alive: true, service }));
      return;
    }

    if (url === '/health' || url === '/health/ready') {
      const checks: Record<string, string> = { service };
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'PASS';
      } catch {
        checks.database = 'FAIL';
      }
      checks.redis = isRedisAvailable() ? 'PASS' : 'FAIL';
      const ready = checks.database === 'PASS' && checks.redis === 'PASS';
      res.writeHead(ready ? 200 : 503);
      res.end(JSON.stringify({ checks, ready, env: config.NODE_ENV, version: config.IMAGE_TAG }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, config.HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[${service}] health on ${config.HOST}:${port}`);
  });

  return server;
}
