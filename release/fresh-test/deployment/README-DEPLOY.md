# NKT VPS Deployment Guide

Deploy NKT backend (API + Realtime + Worker + Admin + PostgreSQL + Redis) to a Linux VPS using Docker Compose.

**This package does NOT include the mobile app.**

---

## Architecture

```
Internet → Nginx (:80/:443)
              ├── API        → nkt-api:3000
              ├── Realtime   → nkt-realtime:3001  (WebSocket)
              └── Admin      → nkt-admin:8080
                    ↓
              PostgreSQL (internal)
              Redis (internal)
              Worker (internal)
```

All NKT services use isolated Docker network `nkt-internal` and named volumes (`nkt_pg_data`, `nkt_redis_data`). They do **not** share database or Redis with other projects.

---

## Recommended VPS Directory

```
/opt/nkt/
```

Use a dedicated deploy user (not root). Example: `deploy@your-vps`

---

## Upload Package (SCP)

From your local machine (after building `release/nkt-vps-deploy.zip`):

```bash
# Replace DEPLOY_USER with your VPS username
scp release/nkt-vps-deploy.zip DEPLOY_USER@76.13.138.159:/tmp/
```

> `76.13.138.159` is an example target IP only. Use your actual VPS address.

---

## VPS Command Sequence

```bash
# 1. SSH into VPS
ssh DEPLOY_USER@76.13.138.159

# 2. Create directory
sudo mkdir -p /opt/nkt
sudo chown $USER:$USER /opt/nkt
cd /opt/nkt

# 3. Extract package
unzip /tmp/nkt-vps-deploy.zip -d /opt/nkt
cd /opt/nkt/nkt-vps-deploy   # or wherever extracted

# 4. Create environment file
cp .env.production.example .env.production
nano .env.production        # fill ALL values — see below

# 5. Validate config
chmod +x deployment/scripts/*.sh
ENV_FILE=.env.production deployment/scripts/check-production-config.sh

# 6. Check port conflicts (does NOT stop other projects)
ENV_FILE=.env.production deployment/scripts/check-ports.sh

# 7. Validate compose
docker compose --env-file .env.production config

# 8. First deploy (build + migrate + seed + start)
ENV_FILE=.env.production deployment/scripts/first-deploy.sh

# 9. Content import (first time only)
# Set ALLOW_CONTENT_IMPORT=true in .env.production, then:
docker compose --env-file .env.production run --rm \
  -e ALLOW_CONTENT_IMPORT=true nkt-api npm run db:import-content
# Then set ALLOW_CONTENT_IMPORT=false

# 10. Health + smoke test
ENV_FILE=.env.production deployment/scripts/smoke-test.sh
```

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `API_HOST` | API domain (e.g. `api.yourdomain.com`) |
| `REALTIME_HOST` | Realtime domain |
| `ADMIN_HOST` | Admin panel domain |
| `VITE_API_URL` | `https://api.yourdomain.com/api/v1` |
| `POSTGRES_PASSWORD` | Strong password (NKT-only DB) |
| `REDIS_PASSWORD` | Strong password (NKT-only Redis) |
| `JWT_ACCESS_SECRET` | Min 32 chars |
| `JWT_REFRESH_SECRET` | Min 32 chars |
| `ADMIN_SEED_PASSWORD` | Admin seed (first deploy only, min 8 chars) |
| `CORS_ORIGINS` | `https://admin.yourdomain.com` |

Generate secrets:
```bash
openssl rand -base64 48
```

---

## Update Deploy

```bash
cd /opt/nkt/nkt-vps-deploy
ENV_FILE=.env.production deployment/scripts/update.sh
```

## Rollback (images only — NOT database)

```bash
ENV_FILE=.env.production deployment/scripts/rollback.sh 1.0.0
```

---

## SSL (Let's Encrypt)

See `docs/SSL.md`. After certificates:

1. Mount certs to `deployment/nginx/ssl/`
2. Set `ENABLE_SSL=true` in `.env.production`
3. Re-run deploy to regenerate nginx configs

---

## Mobile App Connection

After VPS deploy with HTTPS:

```
EXPO_PUBLIC_USE_MOCK_API=false
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
EXPO_PUBLIC_REALTIME_URL=https://realtime.yourdomain.com
```

For local Wi-Fi testing (not VPS):
```
EXPO_PUBLIC_API_URL=http://<LAN_IP>:3000
EXPO_PUBLIC_REALTIME_URL=http://<LAN_IP>:3001
```

---

## ⚠️ Coexistence Warning

If other projects run on the same VPS:

- **Do NOT** delete existing nginx configs or containers
- **Do NOT** stop other services
- Change `NGINX_HTTP_PORT` / `NGINX_HTTPS_PORT` if 80/443 are taken
- NKT uses isolated volumes and network names prefixed with `nkt_`

---

## Firewall

Allow: `22` (SSH), `80`, `443`  
Block public: `5432`, `6379`, `3000-3002`

See `docs/FIREWALL.md`

---

## Monitoring

See `docs/MONITORING.md`. Alerting: **NOT CONFIGURED** (add your provider).

---

## Backup

```bash
ENV_FILE=.env.production deployment/scripts/backup-db.sh
ENV_FILE=.env.production deployment/scripts/restore-db.sh deployment/backups/daily/nkt_YYYYMMDD_HHMMSS.sql.gz
```

---

## Resource Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| RAM | 2 GB free | 4 GB free |
| Disk | 10 GB free | 20 GB free |
| CPU | 2 vCPU shared | 2+ vCPU |

*Actual usage depends on concurrent players and other VPS workloads.*

---

## Support Files

| Path | Purpose |
|------|---------|
| `deployment/scripts/deploy.sh` | Standard deploy |
| `deployment/scripts/first-deploy.sh` | Initial setup |
| `deployment/scripts/update.sh` | Update deploy |
| `deployment/scripts/rollback.sh` | Image rollback |
| `deployment/scripts/smoke-test.sh` | Post-deploy checks |
| `docs/SSL.md` | HTTPS setup |
| `docs/FIREWALL.md` | Firewall rules |
| `docs/MONITORING.md` | Health monitoring |
| `VERSION` | Package version metadata |
