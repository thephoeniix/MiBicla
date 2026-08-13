#!/bin/sh
set -eu

release="${1:?Uso: rollback-release.sh /opt/mibicla/releases/<release>}"
: "${HEALTHCHECK_URL:?HEALTHCHECK_URL es obligatoria}"
test -f "$release/artifacts/api/dist/index.js"
test -f "$release/artifacts/web/dist/index.html"
test -f "$release/packages/db/dist/index.js"
test -f "$release/packages/shared/dist/index.js"
test -f "$release/packages/api-contract/dist/index.js"
test -d "$release/node_modules"
previous="$(readlink -f /opt/mibicla/current)"
restore_previous() {
  ln -sfn "$previous" /opt/mibicla/current.next
  mv -Tf /opt/mibicla/current.next /opt/mibicla/current
  systemctl restart mi-bicla-api.service
}
trap restore_previous EXIT
ln -sfn "$release" /opt/mibicla/current.next
mv -Tf /opt/mibicla/current.next /opt/mibicla/current
systemctl restart mi-bicla-api.service
systemctl is-active --quiet mi-bicla-api.service
curl --connect-timeout 3 --max-time 10 --retry 3 --fail --silent --show-error "$HEALTHCHECK_URL/readyz" >/dev/null
trap - EXIT
