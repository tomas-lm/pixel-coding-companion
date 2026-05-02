#!/usr/bin/env bash
set -euo pipefail

echo "Running checks..."

echo "> pnpm lint"
pnpm lint

echo "> pnpm typecheck"
pnpm typecheck

echo "> pnpm test:run"
pnpm test:run

echo "> pnpm build"
pnpm build

echo "All checks passed."
