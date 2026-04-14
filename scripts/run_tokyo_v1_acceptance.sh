#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/ubuntu/codex/日本房价地图"

cd "$PROJECT_ROOT"
preview_output="$(./scripts/start_tailnet_preview.sh)"
local_url="$(printf '%s\n' "$preview_output" | awk -F= '/^local_http=/{print $2}')"
live_url="$(printf '%s\n' "$preview_output" | awk -F= '/^public_https=/{print $2}')"

if [[ -z "$live_url" ]]; then
  live_url="$(printf '%s\n' "$preview_output" | awk -F= '/^tailnet_https=/{print $2}')"
fi

node ./scripts/tokyo_v1_acceptance.mjs --url "$local_url" --tailnet-url "$live_url"
