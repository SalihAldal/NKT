# NKT Database Guide

PostgreSQL + Prisma migration and operations reference.

## Local Setup

```bash
# Start PostgreSQL + Redis (development)
cd server
docker compose up -d

# Configure connection
export DATABASE_URL="postgresql://nkt:nkt_dev_password@localhost:5432/nkt"

# Apply migrations
npm run db:migrate:deploy

# Generate Prisma client
npm run db:generate

# Seed reference data (categories, badges, flags, admin)
npm run db:seed

# Import 6000 content items (explicit, separate from seed)
npm run db:import-content
```

## Commands

| Command | Purpose | Production |
|---------|---------|------------|
| `npm run db:generate` | Generate Prisma client | Safe |
| `npm run db:migrate:deploy` | Apply pending migrations | **Required on deploy** |
| `npm run db:migrate:dev` | Create/apply dev migrations | Dev only |
| `npm run db:status` | Show migration status | Safe |
| `npm run db:validate` | Schema + drift validation | Run before deploy |
| `npm run db:integrity` | Constraint & flow tests | CI / staging |
| `npm run db:seed` | Reference data (upsert) | Explicit only (`ALLOW_PRODUCTION_SEED=true`) |
| `npm run db:import-content` | 6000 content import | Explicit only (`ALLOW_CONTENT_IMPORT=true`) |
| `npm run db:reset` | Drop + migrate + seed | **Dev only** (`ALLOW_DB_RESET=true`) |

## Production Migration Flow

Production uses **`prisma migrate deploy`** — never `prisma db push` or `prisma migrate reset`.

```bash
# 1. Backup (required — deploy.sh enforces this)
infra/scripts/backup-db.sh

# 2. Deploy migrations
docker compose -f infra/docker-compose.prod.yml run --rm nkt-api \
  npx prisma migrate deploy

# 3. Validate
DATABASE_URL=... npm run db:validate
```

`infra/scripts/deploy.sh` runs backup → migrate deploy → health checks automatically.

## Migration Lock

Prisma uses PostgreSQL advisory locks during `migrate deploy` to prevent concurrent migration runs. Do not run migrations from multiple deploy processes simultaneously.

## Schema Drift Detection

```bash
DATABASE_URL=... npm run db:validate
```

Fails deployment if Prisma schema and database diverge. Fix by creating a new migration in development:

```bash
npm run db:migrate:dev -- --name describe_change
```

## Backup & Restore

```bash
# Backup
infra/scripts/backup-db.sh

# Restore to test database
infra/scripts/restore-db.sh /path/to/backup.sql.gz
```

**Rule:** If backup fails, do not run migrations.

## Seed vs Content

| Layer | Contains | When |
|-------|----------|------|
| Migrations | Schema only | Every deploy |
| Seed | 20 categories, badges, flags, admin | First deploy / explicit |
| Content import | 6000 game items | Separate operator action |

Content is **not** embedded in migrations.

## Account Deletion

Users are soft-deleted (`status=DELETED`, `deletedAt` set). Profile is anonymized. Related data cascades per FK policy:

- **CASCADE:** sessions, friendships, notifications, purchases, etc.
- **SET NULL:** quiz results solver, game players userId, analytics events
- **RESTRICT:** audit logs (admin actions preserved)

## Connection Pool

Production `DATABASE_URL` includes `connection_limit` per service (default 10). Total connections:

```
API pool + Realtime pool + Worker pool < PostgreSQL max_connections
```

Configure via `DB_POOL_SIZE` in `infra/env/.env.production`.

## Health Check

`GET /health/ready` runs `SELECT 1` against PostgreSQL. Database `FAIL` → HTTP 503.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `P3005` database not empty | Baseline with `prisma migrate resolve` or fresh DB |
| Migration failed mid-deploy | Restore backup, fix migration, redeploy |
| Drift detected | Create new migration from schema diff |
| Seed blocked in production | Set `ALLOW_PRODUCTION_SEED=true` explicitly |
| Port 5432 in use | Change docker port or stop conflicting Postgres |

## Production Safety Rules

- ❌ `prisma db push` in production
- ❌ `prisma migrate reset` in production
- ❌ Automatic destructive seed on startup
- ❌ Content data inside migration SQL
- ✅ `prisma migrate deploy` only
- ✅ Backup before every migration
- ✅ Drift check before deploy
