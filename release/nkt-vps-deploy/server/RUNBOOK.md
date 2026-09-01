# NKT Production Runbook

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

## Install

```bash
cd server
cp .env.example .env
# Edit .env with secure JWT secrets (min 32 chars)
npm install
```

## Start Infrastructure

```bash
cd server
docker compose up -d
```

## Database Setup

```bash
cd server
npm run db:generate
npm run db:migrate:dev    # development
npm run db:seed
```

## Start Services

```bash
# Terminal 1 — API + Realtime
cd server && npm run dev

# Terminal 2 — Background workers
cd server && npm run worker
```

## Health Check

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

## Mobile App (Real API)

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_USE_MOCK_API=false
```

## Admin Panel (Real API)

Point admin to `http://localhost:3000/api/v1/admin`

## Environment Separation

| Env | DATABASE_URL | REDIS_URL |
|-----|-------------|-----------|
| development | localhost:5432/nkt | localhost:6379 |
| staging | staging DB URL | staging Redis |
| production | production DB URL | production Redis |

## Backup

- **Daily**: Automated PostgreSQL backup via provider (RDS, etc.)
- **Retention**: 30 days
- **Restore test**: Monthly restore drill to staging

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
psql $DATABASE_URL < backup_YYYYMMDD.sql
```

## Rollback

1. Stop API: `pm2 stop nkt-api` or kill process
2. Rollback migration: `npx prisma migrate resolve --rolled-back <migration>`
3. Deploy previous version
4. Restart services
5. Verify `/health/ready`

## Logs

Structured JSON logs via Pino. Each request includes:
- `requestId`
- `method`, `url`, `statusCode`, `responseTime`

```bash
# Development
npm run dev  # pretty-printed logs

# Production
NODE_ENV=production npm start  # JSON logs
```

## Secrets

Never commit:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `APPLE_SHARED_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `EXPO_ACCESS_TOKEN`

## Content Import

```bash
# From project root
npm run content:generate
# Import via admin panel or API
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| DB connection refused | `docker compose up -d postgres` |
| Redis unavailable | Workers disabled gracefully; start Redis |
| 401 on all requests | Check JWT secrets match between deploys |
| Migration failed | `prisma migrate resolve` then retry |
