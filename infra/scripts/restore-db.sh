#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$INFRA_DIR/backups}"

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Available backups:"
  find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | sort -r | head -20
  echo ""
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Verify checksum if available
if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "[restore] Verifying checksum..."
  if command -v sha256sum &>/dev/null; then
    sha256sum -c "${BACKUP_FILE}.sha256" || { echo "Checksum FAILED"; exit 1; }
  fi
fi

# Verify archive
gunzip -t "$BACKUP_FILE" || { echo "Archive integrity FAILED"; exit 1; }

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  WARNING: This will REPLACE the current database!         ║"
echo "║  Backup: $BACKUP_FILE"
echo "║  Database: $POSTGRES_DB on nkt-postgres                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
read -r -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[restore] Stopping application services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop nkt-api nkt-realtime nkt-worker nkt-admin nkt-nginx 2>/dev/null || true

echo "[restore] Restoring database..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nkt-postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction \
  || { echo "[restore] FAIL"; exit 1; }

echo "[restore] Restarting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

sleep 10
"$SCRIPT_DIR/smoke-test.sh" || echo "[restore] WARNING: Smoke test failed after restore"

echo "[restore] Done"
