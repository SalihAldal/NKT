#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE" 2>/dev/null || true
set +a

API_URL="${SMOKE_API_URL:-http://${API_HOST:-localhost}}"
REALTIME_URL="${SMOKE_REALTIME_URL:-http://${REALTIME_HOST:-localhost}}"
ADMIN_URL="${SMOKE_ADMIN_URL:-http://${ADMIN_HOST:-localhost}}"
FAILURES=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAILURES=$((FAILURES + 1)); }

check_http() {
  local name="$1" url="$2"
  local status
  status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then pass "$name ($status)"; else fail "$name (HTTP $status) — $url"; fi
}

echo "=== NKT Smoke Test ==="

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q nkt-api; then
  echo "Container health:"
  check_http "API readiness" "http://$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-api):3000/health/ready"
  check_http "Realtime readiness" "http://$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-realtime):3001/health/ready"
  check_http "Worker readiness" "http://$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-worker):3002/health/ready"
  check_http "Admin health" "http://$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nkt-admin):8080/health"
fi

echo ""
echo "Public endpoints:"
check_http "API /health" "${API_URL}/health"
check_http "API /health/ready" "${API_URL}/health/ready"
check_http "Realtime /health" "${REALTIME_URL}/health"
check_http "Admin /health" "${ADMIN_URL}/health"

CONFIG=$(curl -sf --max-time 15 "${API_URL}/api/v1/config/app" 2>/dev/null || echo "")
echo "$CONFIG" | grep -q minSupportedVersion && pass "API config" || fail "API config"

WS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  "${REALTIME_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")
[ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "400" ] && pass "Socket.IO reachable ($WS_STATUS)" || fail "Socket.IO ($WS_STATUS)"

echo ""
[ "$FAILURES" -eq 0 ] && echo "SMOKE TEST: PASS" && exit 0
echo "SMOKE TEST: FAIL ($FAILURES)"
exit 1
