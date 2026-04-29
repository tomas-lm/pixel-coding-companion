#!/usr/bin/env bash
set -euo pipefail

echo "Running checks..."

echo "> pnpm lint"
pnpm lint

echo "> pnpm typecheck"
pnpm typecheck

echo "> pnpm build"
pnpm build

echo "All checks passed."
