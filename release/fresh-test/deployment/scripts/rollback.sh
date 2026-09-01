#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

PREVIOUS_TAG="${1:-}"
[ -n "$PREVIOUS_TAG" ] || { echo "Usage: $0 <previous-image-tag>"; exit 1; }

echo "[rollback] Rolling back to IMAGE_TAG=$PREVIOUS_TAG"
export IMAGE_TAG="$PREVIOUS_TAG"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build
sleep 10
"$SCRIPT_DIR/smoke-test.sh" || { echo "[rollback] WARNING: smoke test failed"; exit 1; }
echo "[rollback] Complete — database NOT rolled back. Use restore-db.sh if needed."
