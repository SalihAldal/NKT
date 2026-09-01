#!/usr/bin/env bash
# VPS resource & service monitor — run via cron every 5 minutes
# Alert delivery NOT included — logs to stdout for external collector
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE" 2>/dev/null || true
set +a

API_URL="${SMOKE_API_URL:-https://${API_HOST:-localhost}}"
ALERTS=0

warn() { echo "[monitor] WARN: $*"; ALERTS=$((ALERTS + 1)); }
ok() { echo "[monitor] OK: $*"; }

# Disk usage
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 85 ]; then warn "Disk usage ${DISK_PCT}%"; else ok "Disk ${DISK_PCT}%"; fi

# Docker containers
for svc in nkt-postgres nkt-redis nkt-api nkt-realtime nkt-worker nkt-admin nkt-nginx; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${svc}$"; then
    health=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "none")
    if [ "$health" = "unhealthy" ]; then warn "$svc unhealthy"; else ok "$svc running ($health)"; fi
  else
    warn "$svc not running"
  fi
done

# HTTP health via nginx
if curl -sf "${API_URL}/health/ready" >/dev/null 2>&1; then ok "API ready"; else warn "API not ready"; fi

# Backup freshness (daily dir)
BACKUP_DIR="${BACKUP_DIR:-$INFRA_DIR/backups/daily}"
if [ -d "$BACKUP_DIR" ]; then
  latest=$(find "$BACKUP_DIR" -name '*.sql.gz' -mtime -2 2>/dev/null | head -1)
  if [ -z "$latest" ]; then warn "No backup in last 48h"; else ok "Recent backup: $(basename "$latest")"; fi
else
  warn "Backup directory missing"
fi

echo "[monitor] Alerts: $ALERTS"
[ "$ALERTS" -eq 0 ] && exit 0 || exit 1
