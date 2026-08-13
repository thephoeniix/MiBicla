#!/bin/sh
set -eu

compose="docker compose -f compose.production-smoke.yml"
cleanup() {
  $compose down -v --remove-orphans
}
trap cleanup EXIT INT TERM

SMOKE_KEEP=1 scripts/production-smoke.sh
npx playwright test
