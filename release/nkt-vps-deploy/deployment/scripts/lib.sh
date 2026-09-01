#!/usr/bin/env bash
# NKT VPS Deployment Package — path helpers
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGE_ROOT="$(dirname "$DEPLOYMENT_DIR")"
COMPOSE_FILE="${COMPOSE_FILE:-$PACKAGE_ROOT/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$PACKAGE_ROOT/.env.production}"

export PACKAGE_ROOT DEPLOYMENT_DIR COMPOSE_FILE ENV_FILE
