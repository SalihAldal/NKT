#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy] FAIL:${NC} $*" >&2; exit 1; }

# ── 1. Validate environment ───────────────────────────────────────────────────
log "Validating production config..."
ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/check-production-config.sh" || fail "Config validation failed"

# ── 2. Generate nginx configs ─────────────────────────────────────────────────
log "Generating nginx configs..."
mkdir -p "$INFRA_DIR/nginx/conf.d/generated"
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

SSL_ENABLED="${ENABLE_SSL:-false}"
if [ "$SSL_ENABLED" = "true" ]; then
  log "Using HTTPS nginx templates"
  envsubst '${API_HOST}' < "$INFRA_DIR/nginx/conf.d/api.ssl.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/api.conf"
  envsubst '${REALTIME_HOST}' < "$INFRA_DIR/nginx/conf.d/realtime.ssl.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/realtime.conf"
  envsubst '${ADMIN_HOST}' < "$INFRA_DIR/nginx/conf.d/admin.ssl.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/admin.conf"
else
  log "Using HTTP nginx templates (set ENABLE_SSL=true after certbot)"
  envsubst '${API_HOST}' < "$INFRA_DIR/nginx/conf.d/api.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/api.conf"
  envsubst '${REALTIME_HOST}' < "$INFRA_DIR/nginx/conf.d/realtime.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/realtime.conf"
  envsubst '${ADMIN_HOST}' < "$INFRA_DIR/nginx/conf.d/admin.conf.template" > "$INFRA_DIR/nginx/conf.d/generated/admin.conf"
fi

# ── 3. Validate compose ───────────────────────────────────────────────────────
log "Validating compose config..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null \
  || fail "Compose validation failed"

# ── 4. Build images ───────────────────────────────────────────────────────────
log "Building images (tag: ${IMAGE_TAG:-latest})..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build \
  || fail "Image build failed"

# ── 5. Start database + redis ─────────────────────────────────────────────────
log "Starting database and Redis..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nkt-postgres nkt-redis
sleep 5

# ── 6. Backup before migration ────────────────────────────────────────────────
log "Creating pre-migration backup..."
"$SCRIPT_DIR/backup-db.sh" || fail "Backup failed — aborting deploy"

# Verify backup exists
LATEST_BACKUP=$(find "${BACKUP_DIR:-$INFRA_DIR/backups/daily}" -name '*.sql.gz' -type f 2>/dev/null | sort | tail -1)
if [ -z "$LATEST_BACKUP" ]; then
  fail "Backup verification failed — no backup file found"
fi
log "Backup verified: $LATEST_BACKUP"

# ── 7. Run migrations ─────────────────────────────────────────────────────────
log "Running database migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
  -e SERVICE_ROLE=api \
  nkt-api npx prisma migrate deploy \
  || fail "Migration failed — deploy aborted. Restore from backup if needed."

# ── 8. Start all services ─────────────────────────────────────────────────────
log "Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
  || fail "Service start failed"

# ── 9. Health checks ──────────────────────────────────────────────────────────
log "Waiting for health checks..."
sleep 20
"$SCRIPT_DIR/smoke-test.sh" || fail "Smoke test failed — check logs and consider: $SCRIPT_DIR/rollback.sh"

log "Deployment successful ✓"
log "Run: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"
log "Monitor: $SCRIPT_DIR/monitor.sh"
