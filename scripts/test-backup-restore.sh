#!/bin/sh
set -eu

compose="docker compose -f compose.production-smoke.yml"
backup_volume="mibicla_restore_drill_backups"
database_url="postgresql://mibicla_smoke:smoke_only_password@127.0.0.1:55436/mibicla_production_smoke"
restore_url="postgresql://mibicla_smoke:smoke_only_password@127.0.0.1:55436/mibicla_restore_drill"

cleanup() {
  $compose down -v --remove-orphans
  docker volume rm "$backup_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

$compose down -v --remove-orphans
docker volume rm "$backup_volume" >/dev/null 2>&1 || true
docker volume create "$backup_volume" >/dev/null
$compose up --detach --wait postgres
$compose run --rm migrate

$compose exec -T --env PGPASSWORD=smoke_only_password postgres psql --host 127.0.0.1 --port 55436 --username mibicla_smoke --dbname mibicla_production_smoke \
  --set ON_ERROR_STOP=1 \
  --command "CREATE TABLE restore_drill_sentinel (value text PRIMARY KEY); INSERT INTO restore_drill_sentinel VALUES ('backup-restored');"

docker run --rm --network host \
  --env DATABASE_URL="$database_url" \
  --env BACKUP_DIR=/backups \
  --volume "$PWD/scripts:/scripts:ro" \
  --volume "$backup_volume:/backups" \
  postgres:16-bookworm sh /scripts/backup-db.sh >/dev/null

$compose exec -T --env PGPASSWORD=smoke_only_password postgres createdb --host 127.0.0.1 --port 55436 --username mibicla_smoke mibicla_restore_drill
docker run --rm --network host \
  --volume "$backup_volume:/backups:ro" \
  postgres:16-bookworm sh -c \
  'pg_restore --exit-on-error --no-owner --no-acl --dbname="$1" /backups/mibicla-*.dump' sh "$restore_url"

restored="$($compose exec -T --env PGPASSWORD=smoke_only_password postgres psql --host 127.0.0.1 --port 55436 --username mibicla_smoke --dbname mibicla_restore_drill --tuples-only --no-align --command "SELECT value FROM restore_drill_sentinel;")"
[ "$restored" = "backup-restored" ]
printf '%s\n' "Ensayo de respaldo y restauración aprobado"
