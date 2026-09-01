#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/env/.env.production}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE" 2>/dev/null || true
set +a

# Public URLs — set in .env.production for nginx/HTTPS smoke tests
API_URL="${SMOKE_API_URL:-https://${API_HOST:-localhost}}"
REALTIME_URL="${SMOKE_REALTIME_URL:-https://${REALTIME_HOST:-localhost}}"
ADMIN_URL="${SMOKE_ADMIN_URL:-https://${ADMIN_HOST:-localhost}}"

FAILURES=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAILURES=$((FAILURES + 1)); }

check_http() {
  local name="$1" url="$2" expected="${3:-200}"
  local status
  status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ] || [ "$status" = "200" ]; then
    pass "$name ($status)"
  else
    fail "$name (HTTP $status, expected $expected) — $url"
  fi
}

echo "=== NKT Smoke Test ==="
echo "API: $API_URL"
echo "Realtime: $REALTIME_URL"
echo "Admin: $ADMIN_URL"
echo ""

# Internal container checks when docker available
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q nkt-api; then
  echo "Container health:"
  API_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-api 2>/dev/null || echo 127.0.0.1)
  RT_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-realtime 2>/dev/null || echo 127.0.0.1)
  WK_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-worker 2>/dev/null || echo 127.0.0.1)
  AD_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-admin 2>/dev/null || echo 127.0.0.1)
  check_http "API liveness" "http://${API_IP}:3000/health/live"
  check_http "API readiness" "http://${API_IP}:3000/health/ready"
  check_http "Realtime readiness" "http://${RT_IP}:3001/health/ready" 200
  check_http "Worker readiness" "http://${WK_IP}:3002/health/ready"
  check_http "Admin health" "http://${AD_IP}:8080/health"
fi

echo ""
echo "Public endpoint checks (via nginx):"
check_http "API health" "${API_URL}/health"
check_http "API readiness" "${API_URL}/health/ready"
check_http "Realtime health" "${REALTIME_URL}/health"
check_http "Admin health" "${ADMIN_URL}/health"

# API config endpoint
CONFIG_RESP=$(curl -sf --max-time 15 "${API_URL}/api/v1/config/app" 2>/dev/null || echo "")
if echo "$CONFIG_RESP" | grep -q "minSupportedVersion"; then
  pass "API config endpoint"
else
  fail "API config endpoint"
fi

# WebSocket upgrade header check (does not open socket — checks nginx routes)
WS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  "${REALTIME_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")
if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "400" ] || [ "$WS_STATUS" = "0" ]; then
  pass "Realtime socket.io reachable ($WS_STATUS)"
else
  fail "Realtime socket.io ($WS_STATUS)"
fi

echo ""
echo "NOTE: Destructive tests (room create, game start) skipped in production smoke."
echo "Run full E2E in staging environment."

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "SMOKE TEST: FAIL ($FAILURES failures)"
  exit 1
fi
echo "SMOKE TEST: PASS"
exit 0
