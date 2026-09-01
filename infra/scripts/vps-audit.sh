#!/usr/bin/env bash
# VPS environment audit — run on production server before first deploy
set -euo pipefail

echo "=== NKT VPS Environment Audit ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Hostname: $(hostname)"
echo ""

echo "--- OS ---"
if [ -f /etc/os-release ]; then cat /etc/os-release | head -5; else uname -a; fi
echo ""

echo "--- Resources ---"
echo "CPU cores: $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo unknown)"
free -h 2>/dev/null || vm_stat 2>/dev/null | head -5 || echo "RAM: unknown"
df -h / /var 2>/dev/null || df -h /
echo ""

echo "--- Docker ---"
if command -v docker &>/dev/null; then
  docker --version
  docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "docker compose not found"
else
  echo "FAIL: Docker not installed"
fi
echo ""

echo "--- Listening ports (public) ---"
if command -v ss &>/dev/null; then ss -tlnp 2>/dev/null | head -20
elif command -v netstat &>/dev/null; then netstat -tlnp 2>/dev/null | head -20
else echo "ss/netstat not available"; fi
echo ""

echo "--- Firewall (UFW) ---"
if command -v ufw &>/dev/null; then ufw status verbose 2>/dev/null || echo "UFW not active"
else echo "UFW not installed — configure firewall manually"
fi
echo ""

echo "--- PostgreSQL/Redis public exposure check ---"
for port in 5432 6379; do
  if ss -tln 2>/dev/null | grep -q ":${port} "; then
    bind=$(ss -tln | grep ":${port} " | awk '{print $4}')
    if echo "$bind" | grep -qE '0\.0\.0\.0|\[::\]'; then
      echo "FAIL: Port $port publicly bound ($bind)"
    else
      echo "PASS: Port $port not public ($bind)"
    fi
  else
    echo "PASS: Port $port not listening on host"
  fi
done
echo ""

echo "=== Audit complete — review FAIL items before production traffic ==="
