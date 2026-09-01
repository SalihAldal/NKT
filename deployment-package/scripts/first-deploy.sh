#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[first-deploy]${NC} $*"; }
fail() { echo -e "${RED}[first-deploy] FAIL:${NC} $*" >&2; exit 1; }

echo "=== NKT First Deploy ==="
echo "Package: $PACKAGE_ROOT"
echo ""

# Prerequisites
command -v docker >/dev/null || fail "Docker not installed"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 required"

if [ ! -f "$ENV_FILE" ]; then
  log "Creating .env.production from template..."
  cp "$PACKAGE_ROOT/.env.production.example" "$ENV_FILE"
  fail ".env.production created — fill ALL values then re-run first-deploy.sh"
fi

# Required directories
mkdir -p "$DEPLOYMENT_DIR/backups/daily" "$DEPLOYMENT_DIR/backups/weekly" "$DEPLOYMENT_DIR/backups/monthly"
mkdir -p "$DEPLOYMENT_DIR/nginx/conf.d/generated" "$DEPLOYMENT_DIR/nginx/ssl" "$DEPLOYMENT_DIR/nginx/certbot"

log "Step 1: Validate config"
ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/check-production-config.sh" || fail "Fix .env.production first"

log "Step 2: Port collision check"
"$SCRIPT_DIR/check-ports.sh" || fail "Resolve port conflicts before continuing"

log "Step 3: Deploy stack"
"$SCRIPT_DIR/deploy.sh" || fail "Deploy failed"

log "Step 4: System seed (categories, admin, flags)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
  -e SERVICE_ROLE=api \
  nkt-api npx tsx prisma/seed.ts \
  || fail "Seed failed — ensure ADMIN_SEED_PASSWORD is set in .env.production"

log "Step 5: Content import (6000 items — explicit, idempotent)"
set -a; source "$ENV_FILE"; set +a
if [ "${ALLOW_CONTENT_IMPORT:-false}" != "true" ]; then
  echo "Content import skipped. Set ALLOW_CONTENT_IMPORT=true in .env.production then run:"
  echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE run --rm -e ALLOW_CONTENT_IMPORT=true nkt-api npm run db:import-content"
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
    -e SERVICE_ROLE=api -e ALLOW_CONTENT_IMPORT=true \
    nkt-api npm run db:import-content \
    || fail "Content import failed"
  log "Set ALLOW_CONTENT_IMPORT=false in .env.production after import"
fi

log "Step 6: Final smoke test"
"$SCRIPT_DIR/smoke-test.sh" || fail "Smoke test failed"

echo ""
log "First deploy complete"
log "Next: configure SSL (see docs/SSL.md), set ALLOW_CONTENT_IMPORT=false, configure cron (deployment/cron.example)"
