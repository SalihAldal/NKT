#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-$DEPLOYMENT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/daily/nkt_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

echo "[backup] Creating: $BACKUP_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nkt-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

[ -s "$BACKUP_FILE" ] || { echo "[backup] FAIL: empty file"; exit 1; }
gunzip -t "$BACKUP_FILE" || { echo "[backup] FAIL: corrupt gzip"; exit 1; }

if command -v sha256sum &>/dev/null; then
  sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
fi

if [ -n "${BACKUP_EXTERNAL_PATH:-}" ] && [ -d "$BACKUP_EXTERNAL_PATH" ]; then
  cp "$BACKUP_FILE" "$BACKUP_EXTERNAL_PATH/"
fi

find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS:-7}" -delete 2>/dev/null || true
echo "[backup] Done — $(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE") bytes"
