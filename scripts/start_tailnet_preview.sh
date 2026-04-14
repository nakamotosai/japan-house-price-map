#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/ubuntu/codex/日本房价地图"
APP_NAME="japan-house-price-map-preview"
LOCAL_PORT="4173"
TAILNET_HTTPS_PORT="8443"

cd "$PROJECT_ROOT"
npm run build >/dev/null

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start npm --name "$APP_NAME" --cwd "$PROJECT_ROOT" -- run preview:tailnet >/dev/null

tailscale serve clear "https:${TAILNET_HTTPS_PORT}" >/dev/null 2>&1 || true
tailscale serve --bg --yes --https "$TAILNET_HTTPS_PORT" "http://127.0.0.1:${LOCAL_PORT}" >/dev/null

echo "local_http=http://127.0.0.1:${LOCAL_PORT}/"
echo "tailnet_https=https://vps-jp.tail4b5213.ts.net:${TAILNET_HTTPS_PORT}/"
echo "public_https=https://tokyohouse.saaaai.com/"
