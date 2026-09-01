#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")/env/.env.production}"
ERRORS=0

check() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "FAIL: $name is empty"
    ERRORS=$((ERRORS + 1))
    return
  fi
  if [[ "$value" == CHANGE_ME* ]]; then
    echo "FAIL: $name not configured (CHANGE_ME)"
    ERRORS=$((ERRORS + 1))
    return
  fi
  echo "PASS: $name"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: Environment file not found: $ENV_FILE"
  echo "Copy infra/env/.env.production.example to infra/env/.env.production"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

echo "=== NKT Production Config Check ==="
echo "File: $ENV_FILE"
echo ""

check "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD:-}"
check "REDIS_PASSWORD" "${REDIS_PASSWORD:-}"
check "JWT_ACCESS_SECRET" "${JWT_ACCESS_SECRET:-}"
check "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET:-}"
check "API_HOST" "${API_HOST:-}"
check "REALTIME_HOST" "${REALTIME_HOST:-}"
check "ADMIN_HOST" "${ADMIN_HOST:-}"
check "IMAGE_TAG" "${IMAGE_TAG:-}"
check "CORS_ORIGINS" "${CORS_ORIGINS:-}"
check "VITE_API_URL" "${VITE_API_URL:-}"

# JWT length
if [ "${#JWT_ACCESS_SECRET}" -lt 32 ] 2>/dev/null; then
  echo "FAIL: JWT_ACCESS_SECRET must be at least 32 characters"
  ERRORS=$((ERRORS + 1))
fi
if [ "${#JWT_REFRESH_SECRET}" -lt 32 ] 2>/dev/null; then
  echo "FAIL: JWT_REFRESH_SECRET must be at least 32 characters"
  ERRORS=$((ERRORS + 1))
fi

# Block dev defaults
if [[ "${POSTGRES_PASSWORD:-}" == *dev_password* ]]; then
  echo "FAIL: POSTGRES_PASSWORD contains dev default"
  ERRORS=$((ERRORS + 1))
fi

# VITE_API_URL must include /api/v1 path
if [[ "${VITE_API_URL:-}" != */api/v1 ]]; then
  echo "FAIL: VITE_API_URL must end with /api/v1 (e.g. https://api.domain.com/api/v1)"
  ERRORS=$((ERRORS + 1))
fi

# Block localhost in production URLs
for var in API_HOST REALTIME_HOST ADMIN_HOST VITE_API_URL SMOKE_API_URL SMOKE_REALTIME_URL SMOKE_ADMIN_URL; do
  val="${!var:-}"
  if [[ "$val" == *localhost* || "$val" == *127.0.0.1* ]]; then
    echo "FAIL: $var contains localhost/127.0.0.1"
    ERRORS=$((ERRORS + 1))
  fi
done

# Mock flags must be off
if [ "${USE_MOCK_PAYMENT:-false}" = "true" ]; then
  echo "FAIL: USE_MOCK_PAYMENT must be false in production"
  ERRORS=$((ERRORS + 1))
fi

# Admin seed must not use defaults
if [[ "${ADMIN_SEED_PASSWORD:-super123}" == "super123" ]]; then
  echo "WARN: ADMIN_SEED_PASSWORD uses default — change before production"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "RESULT: FAIL ($ERRORS errors)"
  exit 1
fi
echo "RESULT: PASS"
exit 0
