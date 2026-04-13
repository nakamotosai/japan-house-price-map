#!/usr/bin/env bash
set -euo pipefail

APP_NAME="japan-house-price-map-preview"
TAILNET_HTTPS_PORT="8443"

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
tailscale serve clear "https:${TAILNET_HTTPS_PORT}" >/dev/null 2>&1 || true

echo "stopped ${APP_NAME}"
