# Monitoring

Alerting provider: **NOT CONFIGURED**

## Health Endpoints

| Service | Endpoint |
|---------|----------|
| API | `/health`, `/health/live`, `/health/ready` |
| Realtime | `/health/ready` |
| Worker | `/health/ready` (port 3002 internal) |
| Admin | `/health` |

## Manual Checks

```bash
# Container status
docker compose --env-file .env.production ps

# Smoke test
ENV_FILE=.env.production deployment/scripts/smoke-test.sh

# Disk usage
df -h
docker system df

# Memory
free -h

# Logs
docker compose --env-file .env.production logs -f --tail=100 nkt-api
```

## Recommended Cron (see deployment/cron.example)

- Daily backup: `deployment/scripts/backup-db.sh`
- Disk check: `df -h` alert if >85%

## What to Monitor

- API `/health/ready` returns 200
- PostgreSQL container healthy
- Redis container healthy
- Realtime `/health/ready` returns 200
- Worker `/health/ready` returns 200
- Backup files created daily in `deployment/backups/daily/`
- Disk space on VPS

Add your own alerting (UptimeRobot, Prometheus, etc.) — no credentials included in this package.
