#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/node_modules/maplibre-gl/dist"
DEST_DIR="$ROOT_DIR/public/vendor/maplibre"

mkdir -p "$DEST_DIR"
cp "$SRC_DIR/maplibre-gl.js" "$DEST_DIR/maplibre-gl.js"
cp "$SRC_DIR/maplibre-gl.css" "$DEST_DIR/maplibre-gl.css"
cp "$SRC_DIR/LICENSE.txt" "$DEST_DIR/LICENSE.txt"
