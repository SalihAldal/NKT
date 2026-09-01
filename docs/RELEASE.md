# NKT Production Release Documentation

## Architecture

```
Mobile (Expo) ──HTTP──► Fastify API (/api/v1)
       │                    │
       └──Socket.IO────────► Realtime Server
                            │
                     PostgreSQL (source of truth)
                            │
                         Redis (cache, rate limit, queues)
                            │
                      BullMQ Workers
```

## Local Setup

```bash
# Mobile
cp .env.example .env
npm install
npm start

# Backend
cd server && cp .env.example .env
docker compose up -d
npm install
npm run db:generate && npm run db:migrate:dev && npm run db:seed
npm run dev

# Workers (included in dev server, or standalone)
npm run worker --prefix server

# Admin
npm run admin:dev
```

## Environment Variables

See `.env.example` (mobile) and `server/.env.example` (backend).

**Never commit secrets.** Production requires:
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars)
- `APPLE_SHARED_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON` (IAP)
- `APPLE_WEBHOOK_SECRET`, `GOOGLE_WEBHOOK_SECRET` (webhooks)
- `EXPO_ACCESS_TOKEN` (push)

## Staging vs Production

| Setting | Staging | Production |
|---------|---------|------------|
| `EXPO_PUBLIC_APP_ENV` | staging | production |
| `EXPO_PUBLIC_USE_MOCK_API` | false | false (enforced) |
| `NODE_ENV` | staging | production |
| Ads | test units | production units |

## Migrations

```bash
cd server
npm run db:migrate:dev    # development
npm run db:migrate        # production deploy
```

## Seed

```bash
cd server && npm run db:seed
```

Idempotent — safe to re-run.

## Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

## Rollback

1. Revert deployment to previous container/image
2. Run down migration if schema changed: `prisma migrate resolve`
3. Restore DB from backup if needed

## Backup / Restore

```bash
pg_dump $DATABASE_URL > backup.sql
psql $DATABASE_URL < backup.sql
```

Daily automated backups recommended. Monthly restore drill to staging.

## Release Process

1. All tests pass (`npm test`)
2. TypeScript clean (`npm run typecheck`)
3. `EXPO_PUBLIC_USE_MOCK_API=false` verified
4. Server migrations applied
5. Health checks green
6. EAS build (mobile) / admin build
7. Smoke test primary flows (auth, room, game, premium)

## Incident Response

1. Check `/health/ready` and worker logs
2. Verify Redis/PostgreSQL connectivity
3. Check circuit breaker states in health endpoint
4. Roll back if critical auth/game/payment broken
