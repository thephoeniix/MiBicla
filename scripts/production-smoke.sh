#!/bin/sh
set -eu

compose="docker compose -f compose.production-smoke.yml"
cleanup() {
  if [ "${SMOKE_KEEP:-0}" != "1" ]; then
    $compose down -v --remove-orphans
  fi
}
trap cleanup EXIT INT TERM

$compose down -v --remove-orphans
$compose up --build --detach --wait
curl --resolve mibicla.test:8443:127.0.0.1 --insecure --fail --silent --show-error https://mibicla.test:8443/healthz >/dev/null
curl --resolve mibicla.test:8443:127.0.0.1 --insecure --fail --silent --show-error https://mibicla.test:8443/readyz >/dev/null
curl --resolve mibicla.test:8443:127.0.0.1 --insecure --fail --silent --show-error https://mibicla.test:8443/ >/dev/null
printf '%s\n' "Smoke de producción aprobado en https://mibicla.test:8443"
