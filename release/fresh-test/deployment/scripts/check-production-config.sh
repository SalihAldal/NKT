#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ENV_FILE="${ENV_FILE:-$PACKAGE_ROOT/.env.production}"
ERRORS=0

check() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "FAIL: $name is empty"
    ERRORS=$((ERRORS + 1))
    return
  fi
  if [[ "$value" == CHANGE_ME* ]]; then
    echo "FAIL: $name not configured"
    ERRORS=$((ERRORS + 1))
    return
  fi
  if [[ "$value" == *YOUR_DOMAIN* ]]; then
    echo "FAIL: $name still contains YOUR_DOMAIN placeholder"
    ERRORS=$((ERRORS + 1))
    return
  fi
  echo "PASS: $name"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: $ENV_FILE not found"
  echo "Copy .env.production.example to .env.production"
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

[ "${#JWT_ACCESS_SECRET}" -ge 32 ] 2>/dev/null || { echo "FAIL: JWT_ACCESS_SECRET < 32 chars"; ERRORS=$((ERRORS + 1)); }
[ "${#JWT_REFRESH_SECRET}" -ge 32 ] 2>/dev/null || { echo "FAIL: JWT_REFRESH_SECRET < 32 chars"; ERRORS=$((ERRORS + 1)); }

if [[ "${POSTGRES_PASSWORD:-}" == *dev_password* ]]; then
  echo "FAIL: POSTGRES_PASSWORD contains dev default"
  ERRORS=$((ERRORS + 1))
fi

if [[ "${VITE_API_URL:-}" != */api/v1 ]]; then
  echo "FAIL: VITE_API_URL must end with /api/v1"
  ERRORS=$((ERRORS + 1))
fi

for var in API_HOST REALTIME_HOST ADMIN_HOST VITE_API_URL SMOKE_API_URL SMOKE_REALTIME_URL SMOKE_ADMIN_URL; do
  val="${!var:-}"
  if [[ "$val" == *localhost* || "$val" == *127.0.0.1* ]]; then
    echo "FAIL: $var contains localhost"
    ERRORS=$((ERRORS + 1))
  fi
  if [[ "$val" == *example.com* ]]; then
    echo "FAIL: $var contains example.com"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ "${USE_MOCK_PAYMENT:-false}" = "true" ]; then
  echo "FAIL: USE_MOCK_PAYMENT must be false"
  ERRORS=$((ERRORS + 1))
fi

if [ -z "${ADMIN_SEED_PASSWORD:-}" ]; then
  echo "WARN: ADMIN_SEED_PASSWORD empty — required for first seed"
fi
if [ "${ADMIN_SEED_PASSWORD:-}" = "super123" ]; then
  echo "FAIL: ADMIN_SEED_PASSWORD uses forbidden default"
  ERRORS=$((ERRORS + 1))
fi

echo ""
[ "$ERRORS" -eq 0 ] && echo "RESULT: PASS" && exit 0
echo "RESULT: FAIL ($ERRORS errors)"
exit 1
