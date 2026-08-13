#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL es obligatoria}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/mibicla/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
umask 077
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { printf '%s\n' "Ya existe un respaldo en ejecución" >&2; exit 1; }
target="$(mktemp "$BACKUP_DIR/mibicla-$timestamp-XXXXXX.dump")"
complete=false
cleanup() {
  if [ "$complete" != true ]; then
    rm -f "$target"
  fi
}
trap cleanup EXIT INT TERM
pg_dump --format=custom --dbname="$DATABASE_URL" --no-owner --no-acl --file="$target"
pg_restore --list "$target" >/dev/null
complete=true
(
  cd "$BACKUP_DIR"
  find . -type f -name 'mibicla-*.dump' -mtime "+$RETENTION_DAYS" -delete
)
printf '%s\n' "$target"
