#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/ubuntu/codex/日本房价地图"

cd "$PROJECT_ROOT"
preview_output="$(./scripts/start_tailnet_preview.sh)"
local_url="$(printf '%s\n' "$preview_output" | awk -F= '/^local_http=/{print $2}')"
tailnet_url="$(printf '%s\n' "$preview_output" | awk -F= '/^tailnet_https=/{print $2}')"

node ./scripts/tokyo_v1_acceptance.mjs --url "$local_url" --tailnet-url "$tailnet_url"
