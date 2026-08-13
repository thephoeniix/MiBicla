#!/bin/sh
set -eu

label="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
case "$label" in
  *[!A-Za-z0-9._-]*) printf '%s\n' "La etiqueta solo puede contener letras, números, punto, guion y guion bajo" >&2; exit 1 ;;
esac

name="mibicla-$label"
archive="releases/$name.tar.gz"
checksum="$archive.sha256"
temporary="$archive.tmp"
cleanup() {
  rm -f "$temporary" "$checksum.tmp"
}
trap cleanup EXIT INT TERM

npm run build
mkdir -p releases
tar --create --gzip --file "$temporary" \
  --exclude='*/node_modules' \
  --exclude='*/test-results' \
  --exclude='*/playwright-report' \
  --exclude='artifacts/api/uploads' \
  package.json package-lock.json tsconfig.base.json \
  artifacts packages logo recursos/webp \
  deploy/mi-bicla-api.service deploy/nginx.conf.example \
  deploy/nginx.cloudflare-tunnel.conf deploy/cloudflared.config.example.yml \
  scripts/backup-db.sh scripts/rollback-release.sh \
  docs README.md .env.example
mv "$temporary" "$archive"
(
  cd releases
  sha256sum "$name.tar.gz" > "$name.tar.gz.sha256.tmp"
  mv "$name.tar.gz.sha256.tmp" "$name.tar.gz.sha256"
)
printf '%s\n' "$archive" "$checksum"
