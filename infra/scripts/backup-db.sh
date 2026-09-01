#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$INFRA_DIR/backups}"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/daily/nkt_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

echo "[backup] Creating backup: $BACKUP_FILE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nkt-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

# Verify backup
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[backup] FAIL: Backup file is empty"
  exit 1
fi

SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] FAIL: Backup file too small ($SIZE bytes)"
  exit 1
fi

# Checksum
if command -v sha256sum &>/dev/null; then
  sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
elif command -v shasum &>/dev/null; then
  shasum -a 256 "$BACKUP_FILE" > "$CHECKSUM_FILE"
fi

# Test archive integrity
gunzip -t "$BACKUP_FILE" || { echo "[backup] FAIL: gzip integrity check failed"; exit 1; }

echo "[backup] Backup OK — size: $SIZE bytes"

# Weekly copy on Sundays
if [ "$(date +%u)" -eq 7 ]; then
  cp "$BACKUP_FILE" "$BACKUP_DIR/weekly/nkt_weekly_${TIMESTAMP}.sql.gz"
fi

# Monthly copy on 1st
if [ "$(date +%d)" -eq 01 ]; then
  cp "$BACKUP_FILE" "$BACKUP_DIR/monthly/nkt_monthly_${TIMESTAMP}.sql.gz"
fi

# Retention: daily
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS:-7}" -delete 2>/dev/null || true
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -mtime +$(( "${BACKUP_RETENTION_WEEKS:-4}" * 7 )) -delete 2>/dev/null || true
find "$BACKUP_DIR/monthly" -name "*.sql.gz" -mtime +$(( "${BACKUP_RETENTION_MONTHS:-3}" * 30 )) -delete 2>/dev/null || true

# External backup destination
if [ -n "${BACKUP_EXTERNAL_PATH:-}" ] && [ -d "$BACKUP_EXTERNAL_PATH" ]; then
  cp "$BACKUP_FILE" "$BACKUP_EXTERNAL_PATH/"
  [ -f "$CHECKSUM_FILE" ] && cp "$CHECKSUM_FILE" "$BACKUP_EXTERNAL_PATH/"
  echo "[backup] Copied to external: $BACKUP_EXTERNAL_PATH"
fi

echo "[backup] Done"
