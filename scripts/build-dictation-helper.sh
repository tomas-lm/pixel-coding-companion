#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$ROOT_DIR/native/pixel-dictation-helper"
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
