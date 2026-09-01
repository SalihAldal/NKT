#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
PREVIOUS_TAG="${1:-}"

if [ -z "$PREVIOUS_TAG" ]; then
  echo "Usage: $0 <previous-image-tag>"
  echo "Example: $0 1.1.0"
  exit 1
fi

echo "[rollback] Rolling back to image tag: $PREVIOUS_TAG"

export IMAGE_TAG="$PREVIOUS_TAG"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build

sleep 10
"$SCRIPT_DIR/smoke-test.sh" || {
  echo "[rollback] WARNING: Smoke test failed after rollback"
  exit 1
}

echo "[rollback] Rollback to $PREVIOUS_TAG complete"
echo "[rollback] NOTE: Database was NOT rolled back. Use restore-db.sh if migration caused issues."
