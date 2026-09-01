#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

set -a
# shellcheck source=/dev/null
source "${ENV_FILE:-$PACKAGE_ROOT/.env.production}" 2>/dev/null || true
set +a

HTTP_PORT="${NGINX_HTTP_PORT:-80}"
HTTPS_PORT="${NGINX_HTTPS_PORT:-443}"
FAILURES=0

check_port() {
  local port="$1" label="$2"
  if command -v ss >/dev/null 2>&1; then
    if ss -tln | grep -q ":${port} "; then
      PROC=$(ss -tlnp 2>/dev/null | grep ":${port} " | head -1 || true)
      echo "FAIL: Port $port ($label) already in use: $PROC"
      FAILURES=$((FAILURES + 1))
    else
      echo "PASS: Port $port ($label) available"
    fi
  elif command -v netstat >/dev/null 2>&1; then
    if netstat -tln 2>/dev/null | grep -q ":${port} "; then
      echo "FAIL: Port $port ($label) already in use"
      FAILURES=$((FAILURES + 1))
    else
      echo "PASS: Port $port ($label) available"
    fi
  else
    echo "SKIP: Cannot check port $port (ss/netstat unavailable)"
  fi
}

echo "=== NKT Port Collision Check ==="
echo "NOTE: If ports are used by another project, change NGINX_HTTP_PORT/NGINX_HTTPS_PORT in .env.production"
echo "      Do NOT stop other projects automatically."
echo ""

check_port "$HTTP_PORT" "nginx-http"
check_port "$HTTPS_PORT" "nginx-https"

# Internal ports must NOT be exposed on host
for port in 5432 6379 3000 3001 3002; do
  if ss -tln 2>/dev/null | grep -q ":${port} " || netstat -tln 2>/dev/null | grep -q ":${port} "; then
    echo "WARN: Port $port open on host — ensure NKT does not bind this publicly"
  fi
done

[ "$FAILURES" -eq 0 ] && echo "RESULT: PASS" && exit 0
echo "RESULT: FAIL ($FAILURES conflicts)"
exit 1
