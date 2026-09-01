# NKT VPS Production Deployment Guide

## Architecture

```
Internet → Nginx (80/443)
              ├── api.${DOMAIN}      → nkt-api:3000
              ├── realtime.${DOMAIN} → nkt-realtime:3001 (WebSocket)
              └── admin.${DOMAIN}    → nkt-admin:8080

Docker Network (internal):
  nkt-api | nkt-realtime | nkt-worker | nkt-admin | nkt-postgres | nkt-redis
```

PostgreSQL is the source of truth. Redis is used for cache, queues, and Socket.IO adapter — not persistent business state.

## VPS Requirements

| Resource | Minimum (start) | Recommended |
|----------|-----------------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04+ LTS | Ubuntu 24.04 LTS |
| Bandwidth | 1 TB/month | As needed |

Capacity depends on concurrent users, game sessions, and content size. No fixed user guarantee on a single VPS.

## Prerequisites

- Docker 24+ and Docker Compose v2
- Git
- Domain with DNS access (A records for API, realtime, admin subdomains)
- SSH key authentication

## First-Time VPS Setup

### 1. Create deploy user

```bash
adduser nkt-deploy
usermod -aG docker nkt-deploy
```

Do not deploy as root.

### 2. Firewall (UFW)

```bash
ufw default deny incoming
ufw allow 22/tcp    # SSH — change port if customized
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**BLOCK:** 5432 (PostgreSQL), 6379 (Redis), internal Docker ports.

### 3. SSH Hardening

- Use SSH key auth only
- Disable password login: `PasswordAuthentication no`
- Disable root login: `PermitRootLogin no`
- Install fail2ban: `apt install fail2ban`

### 4. Clone repository

```bash
sudo -u nkt-deploy git clone <repo-url> /opt/nkt
cd /opt/nkt
```

### 5. Configure environment

```bash
cp infra/env/.env.production.example infra/env/.env.production
# Edit with real values — never commit this file
nano infra/env/.env.production
```

Required variables: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_HOST`, `REALTIME_HOST`, `ADMIN_HOST`, `VITE_API_URL`.

### 6. Validate config

```bash
bash infra/scripts/check-production-config.sh
```

### 7. DNS Records

| Type | Name | Value |
|------|------|-------|
| A | api | VPS_IP |
| A | realtime | VPS_IP |
| A | admin | VPS_IP |

Replace with your actual domain. Do not use example.com in production.

### 8. SSL / HTTPS (Let's Encrypt)

```bash
apt install certbot
certbot certonly --webroot -w /var/www/certbot -d api.yourdomain.com -d realtime.yourdomain.com -d admin.yourdomain.com
```

Mount certificates to `infra/nginx/ssl/`. Configure HTTPS server blocks in nginx (extend generated configs).

Renewal cron:
```
0 3 * * * certbot renew --quiet && docker compose -f /opt/nkt/infra/docker-compose.prod.yml restart nkt-nginx
```

### 9. Deploy

```bash
bash infra/scripts/deploy.sh
```

Deploy flow: validate env → build images → backup DB → migrate → start services → smoke test.

## Maintenance Commands

| Command | Description |
|---------|-------------|
| `bash infra/scripts/deploy.sh` | Full deployment |
| `bash infra/scripts/rollback.sh <tag>` | Rollback app images |
| `bash infra/scripts/backup-db.sh` | Manual backup |
| `bash infra/scripts/restore-db.sh <file>` | Restore database |
| `bash infra/scripts/smoke-test.sh` | Health smoke test |
| `bash infra/scripts/check-production-config.sh` | Validate env |
| `docker compose -f infra/docker-compose.prod.yml ps` | Service status |
| `docker compose -f infra/docker-compose.prod.yml logs -f nkt-api` | API logs |

## Database

### Migrations

Migrations run automatically during deploy. Manual:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/env/.env.production \
  run --rm nkt-api npx prisma migrate deploy
```

### Seed (system data only)

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/env/.env.production \
  run --rm nkt-api npx prisma db seed
```

**Never** auto-seed on production startup. Content import is a separate operator action.

### Backup Policy

| Type | Default Retention |
|------|-------------------|
| Daily | 7 days |
| Weekly | 4 weeks |
| Monthly | 3 months |

Backups stored in `infra/backups/` and optionally copied to `BACKUP_EXTERNAL_PATH`.

Cron (daily 2 AM):
```
0 2 * * * /opt/nkt/infra/scripts/backup-db.sh >> /var/log/nkt-backup.log 2>&1
```

## Rollback

### Application rollback

```bash
bash infra/scripts/rollback.sh 1.1.0
```

### Database rollback

Destructive migrations cannot be auto-rolled back. Use:

```bash
bash infra/scripts/restore-db.sh infra/backups/daily/nkt_YYYYMMDD_HHMMSS.sql.gz
```

## Cloudflare Compatibility

If using Cloudflare proxy:

- SSL mode: **Full (strict)**
- Enable WebSocket support
- Real client IP: configure `real_ip_header CF-Connecting-IP` in nginx
- Rate limiting: combine Cloudflare rules with nginx limits

Cloudflare is optional.

## Monitoring Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Disk usage | 70% | 85% |
| RAM usage | 80% | 90% |
| Container restarts | 3/hour | 10/hour |
| API 5xx rate | 1% | 5% |
| Queue depth | 1000 | 5000 |

## Disaster Recovery

If VPS is lost:

1. Provision new VPS
2. Install Docker
3. Restore firewall/SSH config
4. Clone repo + restore `infra/env/.env.production` from secure backup
5. Restore database from external backup
6. Run `bash infra/scripts/deploy.sh`
7. Verify DNS points to new IP
8. Run smoke tests

## Troubleshooting

| Issue | Check |
|-------|-------|
| API 503 | `curl http://localhost/health/ready` via nginx |
| Realtime disconnect | nginx WebSocket config, Redis adapter |
| Worker not processing | `docker logs nkt-worker`, Redis connectivity |
| Migration failed | Restore backup, fix migration, redeploy |
| Disk full | `docker system prune`, log rotation, backup cleanup |

## Security Checklist

- [ ] PostgreSQL not public
- [ ] Redis not public
- [ ] No secrets in git
- [ ] JWT secrets ≥ 32 chars
- [ ] Webhook secrets configured
- [ ] Admin uses real API (VITE_ADMIN_USE_MOCK=false)
- [ ] SSH hardened
- [ ] Backups on external storage

## Zero-Downtime Note

On a single VPS, deploy may cause brief service interruption during container restart. True zero-downtime requires multiple instances and load balancing — not guaranteed on single-node setup.
