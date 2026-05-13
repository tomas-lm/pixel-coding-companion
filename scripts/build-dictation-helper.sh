#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$ROOT_DIR/native/pixel-dictation-helper"
GLOBAL_SHORTCUT_DIR="$ROOT_DIR/native/pixel-global-shortcut"
OUTPUT_DIR="$ROOT_DIR/resources/native"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Skipping macOS dictation helper build on non-Darwin host."
  exit 0
fi

mkdir -p "$OUTPUT_DIR"
swift build \
  --package-path "$HELPER_DIR" \
  -c release \
  --product pixel-dictation-helper
cp "$HELPER_DIR/.build/release/pixel-dictation-helper" "$OUTPUT_DIR/pixel-dictation-helper"
chmod +x "$OUTPUT_DIR/pixel-dictation-helper"

"$ROOT_DIR/node_modules/.bin/node-gyp" rebuild --directory "$GLOBAL_SHORTCUT_DIR"
cp "$GLOBAL_SHORTCUT_DIR/build/Release/pixel_global_shortcut.node" \
  "$OUTPUT_DIR/pixel_global_shortcut.node"
