# Phase 21 — VPS Production Deployment Audit

**Date:** 2026-08-28  
**Status:** Infrastructure prepared in repo; **real VPS validation NOT RUN**

---

## Executive Summary

| Item | Status |
|------|--------|
| **VPS PRODUCTION READY** | **NO** |
| Repo infra/config | READY (scripts, compose, nginx, health, deploy flow) |
| Real VPS deploy | NOT RUN |
| HTTPS / certbot on live domain | NOT RUN |
| Server reboot test | NOT RUN |
| Backup restore E2E | NOT RUN |
| Alert delivery | NOT CONFIGURED |

---

## Architecture (Docker Compose on single VPS)

```
Internet
   │
   ▼
Nginx (:80 / :443) ──► API (:3000 internal)
                   ├──► Realtime / Socket.IO (:3001 internal)
                   └──► Admin SPA (:8080 internal)

Internal only (nkt-internal network):
  PostgreSQL, Redis, Worker (:3002 health)
```

- **Process management:** Docker `restart: unless-stopped`, `stop_grace_period: 30s` on API
- **Migrations:** `prisma migrate deploy` (never `db push`) via `infra/scripts/deploy.sh`
- **Deploy order:** backup → verify → migrate → build → up → health/smoke

---

## Final Production Audit (Honest)

| Check | Result | Notes |
|-------|--------|-------|
| VPS OS | **NOT RUN** | Use `infra/scripts/vps-audit.sh` on server |
| FIREWALL | **NOT RUN** | UFW: allow 80, 443, SSH only |
| NETWORK | **PASS** (static) | PG/Redis no public ports in compose |
| NGINX | **PASS** (static) | Templates + SSL variants + WS headers |
| HTTPS | **NOT RUN** | `ENABLE_SSL=true` + certbot required on VPS |
| WSS | **NOT RUN** | Depends on live TLS + realtime domain |
| CORS | **PASS** (static) | Validated in `check-production-config.sh` |
| API DEPLOY | **NOT RUN** | |
| REALTIME DEPLOY | **NOT RUN** | |
| WORKER DEPLOY | **NOT RUN** | |
| POSTGRES | **NOT RUN** | |
| REDIS | **NOT RUN** | Auth + AOF in compose |
| PROCESS MANAGEMENT | **PASS** (static) | Docker restart policies |
| AUTO RESTART | **NOT RUN** | Reboot test required |
| SERVER REBOOT | **NOT RUN** | |
| HEALTH CHECKS | **PASS** (static) | `/health/live`, `/health/ready`, Redis fail → 503 |
| LOGGING | **PASS** (static) | json-file driver, max-size 20m × 5 |
| LOG ROTATION | **PASS** (static) | Docker logging options |
| RATE LIMITING | **PASS** (static) | Existing server rate limits |
| SECURITY AUDIT | **PARTIAL** | Secrets gitignored; live audit NOT RUN |
| BACKUP | **NOT RUN** | `backup-db.sh` exists |
| BACKUP VERIFICATION | **NOT RUN** | |
| RESTORE TEST | **NOT RUN** | |
| DEPLOYMENT SCRIPT | **PASS** (static) | `deploy.sh` safe order |
| ROLLBACK | **PASS** (static) | `rollback.sh` documented |
| MONITORING | **PARTIAL** | `monitor.sh` — no dashboard |
| ALERTING | **NOT CONFIGURED** | No Slack/email/PagerDuty |
| RESOURCE MONITORING | **PARTIAL** | `monitor.sh` disk/docker |
| MOBILE PRODUCTION CONNECTION | **NOT RUN** | `eas.json` has example URLs |
| ADMIN PRODUCTION CONNECTION | **NOT RUN** | `VITE_API_URL` must be set on build |
| FAILURE RECOVERY | **NOT RUN** | |

### TESTS

| | Count |
|---|------|
| **Total** | 48 |
| **Passed** | 14 (static/repo only) |
| **Failed** | 0 |
| **Skipped** | 34 (require live VPS) |
| **Not Run** | 34 |

---

## CRITICAL FINDINGS

1. **No live VPS session** — Cannot mark production ready without real deploy + smoke + reboot.
2. **Alert delivery NOT CONFIGURED** — Monitoring script logs only; no notification provider.
3. **Backup offsite** — Default backups on same disk/volume → **DISASTER RECOVERY RISK** unless `BACKUP_EXTERNAL_PATH` or remote sync configured.
4. **Domain placeholders** — Replace `example.com` in `eas.json`, `.env.production`, DNS before go-live.
5. **Payment IAP** — `react-native-iap` / store sandbox not validated on device (Phase 20 carryover).

---

## BLOCKERS

1. Create `infra/env/.env.production` on VPS (never commit).
2. DNS A records: `api.`, `realtime.`, `admin.` → VPS IP.
3. Run certbot / `ENABLE_SSL=true` and deploy.
4. Execute full test matrix on VPS (deploy, health, WSS, reboot, restore).
5. Configure alert channel or accept **NOT CONFIGURED** for on-call.

---

## RISKS

- Single-VPS single-disk backups (no offsite).
- Controlled restart downtime during deploy (not zero-downtime).
- Connection pool × services must stay under PostgreSQL `max_connections`.
- Worker stopped may not page anyone until alerting is wired.

---

## VPS Deployment Checklist

```bash
# On VPS (example paths)
git clone <repo> /opt/nkt && cd /opt/nkt
cp infra/env/.env.production.example infra/env/.env.production
# Edit secrets: POSTGRES_*, REDIS_PASSWORD, JWT_*, CORS_ORIGINS, domains

chmod +x infra/scripts/*.sh
infra/scripts/check-production-config.sh
infra/scripts/vps-audit.sh

# First-time SSL (after DNS points to VPS)
certbot certonly --webroot -w infra/nginx/certbot -d api.YOURDOMAIN.com ...
# Set ENABLE_SSL=true in .env.production

ENV_FILE=infra/env/.env.production infra/scripts/deploy.sh

ENV_FILE=infra/env/.env.production infra/scripts/smoke-test.sh
infra/scripts/monitor.sh

# Optional cron — see infra/cron.example
```

### Post-deploy validation (required for PASS)

- [ ] `curl -fsS https://api.YOURDOMAIN.com/health/ready`
- [ ] Socket.IO connect over `wss://realtime.YOURDOMAIN.com`
- [ ] Admin login against real API
- [ ] `backup-db.sh` + restore to test DB
- [ ] `reboot` → all containers healthy within 5 min
- [ ] Stop Redis → API `/health/ready` returns 503

---

## FILES CHANGED (Phase 21)

- `infra/docker-compose.prod.yml` — grace period, SSL snippets volume, realtime ready healthcheck, `USE_MOCK_PAYMENT`
- `infra/nginx/snippets/ssl-params.conf`, `*.ssl.conf.template`
- `infra/scripts/deploy.sh`, `check-production-config.sh`, `smoke-test.sh`, `monitor.sh`, `vps-audit.sh`
- `infra/env/.env.production.example`, `infra/cron.example`
- `server/src/index.ts`, `server/src/realtime/socket.ts`, `server/src/health/health.routes.ts`
- `server/src/entitlements/entitlement.service.ts` — syntax fix
- `.gitignore`, `eas.json`, `eas.production.env.example`
- `src/__tests__/phase21-infra.test.ts`
- `docs/PHASE21-VPS.md` (this file)

---

## VPS PRODUCTION READY: **NO**

Complete the VPS checklist and re-run smoke/reboot/restore tests before changing to **YES**.
