#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

echo "WARNING: This will overwrite NKT database: $POSTGRES_DB"
echo "Type RESTORE to confirm:"
read -r CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "Aborted"; exit 1; }

gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nkt-postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[restore] Done — run smoke-test.sh to verify"
