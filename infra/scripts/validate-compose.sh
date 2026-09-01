#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"

echo "=== Compose Validation ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null
echo "PASS: docker compose config"

echo ""
echo "=== Service List ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --services

echo ""
echo "=== Port Exposure Check ==="
# Ensure postgres and redis have no host ports
CONFIG=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config)
if echo "$CONFIG" | grep -A5 "nkt-postgres:" | grep -q "published:"; then
  echo "FAIL: PostgreSQL has public port"
  exit 1
fi
if echo "$CONFIG" | grep -A5 "nkt-redis:" | grep -q "published:"; then
  echo "FAIL: Redis has public port"
  exit 1
fi
echo "PASS: PostgreSQL and Redis not publicly exposed"

echo ""
echo "VALIDATION: PASS"
