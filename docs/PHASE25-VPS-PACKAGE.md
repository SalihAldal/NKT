# Phase 25 — VPS Deployment Package

**Date:** 2026-08-28  
**VPS:** NOT DEPLOYED (package only)

---

## PHASE 25 STATUS

| Item | Status |
|------|--------|
| PACKAGE | **PASS** |
| ZIP | **PASS** |
| ZIP PATH | `release/nkt-vps-deploy.zip` |
| ZIP SIZE | ~614 KB (compressed; content dataset ~4.6 MB uncompressed) |
| SECRETS SCAN | **PASS** |
| LOCALHOST SCAN | **PASS** |
| PRODUCTION CONFIG | **PASS** |
| DOCKER | **PASS** (Dockerfile multi-stage, non-root) |
| COMPOSE | **PASS** (`docker compose config`) |
| DATABASE | **PASS** (Prisma migrations included) |
| REDIS | **PASS** (internal only, password required) |
| API | **PASS** |
| REALTIME | **PASS** (Socket.IO nginx templates) |
| WORKER | **PASS** |
| ADMIN | **PASS** (VITE_ADMIN_USE_MOCK=false) |
| NGINX | **PASS** (API/Realtime/Admin + WSS) |
| MIGRATIONS | **PASS** (`prisma migrate deploy` in deploy flow) |
| SEED | **PASS** (explicit, `ADMIN_SEED_PASSWORD` required) |
| CONTENT IMPORT | **PASS** (explicit, idempotent, `ALLOW_CONTENT_IMPORT`) |
| BACKUP | **PASS** |
| RESTORE | **PASS** |
| HEALTH | **PASS** |
| SMOKE TEST | **PASS** (script included) |
| PORT COLLISION CHECK | **PASS** |
| DATABASE ISOLATION | **PASS** (`nkt_pg_data`, `POSTGRES_DB` configurable) |
| REDIS ISOLATION | **PASS** (dedicated container, password) |
| RESOURCE LIMITS | **PASS** (lightweight defaults in compose) |
| ROLLBACK | **PASS** (image rollback script; no auto DB rollback) |
| DOCUMENTATION | **PASS** |
| FRESH PACKAGE TEST | **PASS** (extracted + compose config) |

**VPS:** NOT DEPLOYED — no SSH connection made.

---

## Build Command

```bash
npm run package:vps
```

Output: `release/nkt-vps-deploy.zip`

---

## Package Contents

```
nkt-vps-deploy/
├── server/              # Backend source + Prisma + migrations
├── admin/               # Admin SPA source
├── deployment/          # Docker, nginx, scripts, docs
├── docker-compose.yml
├── README-DEPLOY.md
├── .env.example
├── .env.production.example
└── VERSION
```

## Excluded

- `node_modules`, `.git`, `.env`, secrets, mobile app
- `dist/`, test output, caches, logs
- Real credentials, private keys

## Included

- 6000 content dataset (`server/data/content-dataset.json`)
- Deployment scripts: `first-deploy.sh`, `deploy.sh`, `update.sh`, `rollback.sh`
- Backup/restore, smoke-test, port-collision check
- SSL, firewall, monitoring documentation

---

## VPS Upload (example)

```bash
scp release/nkt-vps-deploy.zip DEPLOY_USER@76.13.138.159:/tmp/
ssh DEPLOY_USER@76.13.138.159
```

See `README-DEPLOY.md` inside the package for full command sequence.

---

## Important

- IP `76.13.138.159` appears **only in documentation** as an example SCP target
- No secrets generated or committed
- Coexistence warnings for shared VPS included in README
- Lightweight resource limits for shared VPS workloads
