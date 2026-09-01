#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy] FAIL:${NC} $*" >&2; exit 1; }

log "Package root: $PACKAGE_ROOT"
log "Validating production config..."
ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/check-production-config.sh" || fail "Config validation failed"

log "Checking port collisions..."
"$SCRIPT_DIR/check-ports.sh" || fail "Port collision detected"

log "Generating nginx configs..."
mkdir -p "$DEPLOYMENT_DIR/nginx/conf.d/generated"
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

NGINX_DIR="$DEPLOYMENT_DIR/nginx"
if [ "${ENABLE_SSL:-false}" = "true" ]; then
  log "Using HTTPS nginx templates"
  envsubst '${API_HOST}' < "$NGINX_DIR/conf.d/api.ssl.conf.template" > "$NGINX_DIR/conf.d/generated/api.conf"
  envsubst '${REALTIME_HOST}' < "$NGINX_DIR/conf.d/realtime.ssl.conf.template" > "$NGINX_DIR/conf.d/generated/realtime.conf"
  envsubst '${ADMIN_HOST}' < "$NGINX_DIR/conf.d/admin.ssl.conf.template" > "$NGINX_DIR/conf.d/generated/admin.conf"
else
  log "Using HTTP nginx templates"
  envsubst '${API_HOST}' < "$NGINX_DIR/conf.d/api.conf.template" > "$NGINX_DIR/conf.d/generated/api.conf"
  envsubst '${REALTIME_HOST}' < "$NGINX_DIR/conf.d/realtime.conf.template" > "$NGINX_DIR/conf.d/generated/realtime.conf"
  envsubst '${ADMIN_HOST}' < "$NGINX_DIR/conf.d/admin.conf.template" > "$NGINX_DIR/conf.d/generated/admin.conf"
fi

log "Validating compose..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null || fail "Compose validation failed"

log "Building images (tag: ${IMAGE_TAG:-latest})..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build || fail "Image build failed"

log "Starting database and Redis..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nkt-postgres nkt-redis
sleep 5

log "Creating pre-migration backup..."
"$SCRIPT_DIR/backup-db.sh" || fail "Backup failed — aborting deploy"

LATEST_BACKUP=$(find "${BACKUP_DIR:-$DEPLOYMENT_DIR/backups/daily}" -name '*.sql.gz' -type f 2>/dev/null | sort | tail -1)
[ -n "$LATEST_BACKUP" ] || fail "Backup verification failed"
log "Backup verified: $LATEST_BACKUP"

log "Running migrations (prisma migrate deploy)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
  -e SERVICE_ROLE=api \
  nkt-api npx prisma migrate deploy \
  || fail "Migration failed"

log "Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d || fail "Service start failed"

log "Waiting for health checks..."
sleep 20
"$SCRIPT_DIR/smoke-test.sh" || fail "Smoke test failed — consider: $SCRIPT_DIR/rollback.sh <previous-tag>"

log "Deployment successful"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
