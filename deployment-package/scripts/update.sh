#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "=== NKT Update Deploy ==="
"$SCRIPT_DIR/deploy.sh"
