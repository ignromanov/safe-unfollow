#!/usr/bin/env bash
# Full copy of the old Umami database (Supabase) into the local Postgres.
#
#   bin/migrate.sh            # refuses if the local database already has tables
#   bin/migrate.sh --force    # drops the local public schema first (re-runs, rehearsals)
#
# Umami must be stopped: it applies migrations on start, and a schema it created
# in the empty database would collide with the restore.
#
# Only the `public` schema is copied — that is where Umami's tables live. Supabase's
# own schemas (auth, storage, realtime, …) stay behind, and so do the Supabase
# roles: ownership and grants are dropped and the local `umami` user owns everything.
#
# The dump's start time is written to dumps/last-dump-started-at. Everything the
# old instance records after that moment is picked up by bin/sync-delta.sh.

# shellcheck source=bin/_lib.sh
source "$(dirname "$0")/_lib.sh"

require SOURCE_DATABASE_URL

force=false
[ "${1:-}" = --force ] && force=true

service_running umami && die "umami is running — docker compose stop cloudflared umami"

compose up -d --wait db

tables=$(psql_local -tAc "select count(*) from pg_tables where schemaname = 'public'")
if [ "$tables" != 0 ] && [ "$force" != true ]; then
  die "local database already has $tables tables — re-run with --force to replace them"
fi

mkdir -p dumps
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump=/dumps/source-$stamp.dump
started_at=$(date -u +%FT%TZ)

log "Dumping the source database (public schema) to dumps/source-$stamp.dump"
compose exec -T db pg_dump "$SOURCE_DATABASE_URL" \
  --schema=public --format=custom --no-owner --no-privileges \
  --no-publications --no-subscriptions --file "$dump"
echo "$started_at" >dumps/last-dump-started-at

# Row-level-security policies can reference Supabase's auth schema, and the
# public schema itself already exists locally — leave both out of the restore.
compose exec -T db sh -c "pg_restore --list '$dump' | grep -v -E ' (POLICY|SCHEMA) ' >/dumps/restore.list"

log "Restoring into the local database"
psql_local -q -c 'drop schema if exists public cascade' -c 'create schema public'
compose exec -T db pg_restore -U umami -d umami --no-owner --no-privileges \
  --exit-on-error --use-list /dumps/restore.list "$dump"
psql_local -q -c 'analyze'

log "Row counts, source → local:"
for table in website_event event_data session website; do
  source_count=$(psql_source -tAc "select count(*) from public.$table")
  local_count=$(psql_local -tAc "select count(*) from public.$table")
  printf '  %-15s %10s → %-10s %s\n' "$table" "$source_count" "$local_count" \
    "$([ "$source_count" = "$local_count" ] && echo ok || echo 'DIFFERS (rows written during the dump are expected; re-check after sync-delta)')"
done

log "Done. Rows written to the source after $started_at are copied by: bin/sync-delta.sh"
