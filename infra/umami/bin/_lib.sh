# shellcheck shell=bash
# Shared by the scripts in this directory. Sourced, not executed.
#
# Every script runs from the compose project directory and talks to Postgres
# through the `db` container, so the host needs nothing but Docker: the
# container's own psql/pg_dump (17) also reach the old Supabase database,
# which is why no client has to be installed on the VPS for the migration.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() {
  log "ERROR: $*" >&2
  exit 1
}

[ -f .env ] || die "no .env in $PWD — copy .env.example and fill it in"

# Read .env as data rather than sourcing it: connection strings carry `&` and
# `?`, which a shell would act on. Surrounding quotes are stripped the way
# docker compose strips them, so both tools see the same values.
while IFS= read -r line || [ -n "$line" ]; do
  case $line in '' | '#'*) continue ;; esac
  key=${line%%=*}
  value=${line#*=}
  case $value in
    \"*\") value=${value#\"} value=${value%\"} ;;
    \'*\') value=${value#\'} value=${value%\'} ;;
  esac
  export "$key=$value"
done <.env

require() {
  local name
  for name; do
    [ -n "${!name:-}" ] || die "$name is empty in .env"
  done
}

compose() { docker compose "$@"; }

# Local socket connections are trusted inside the official postgres image.
psql_local() { compose exec -T db psql -U umami -d umami -v ON_ERROR_STOP=1 -X "$@"; }
psql_source() { compose exec -T db psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -X "$@"; }

service_running() {
  [ -n "$(compose ps --status running --quiet "$1" 2>/dev/null)" ]
}
