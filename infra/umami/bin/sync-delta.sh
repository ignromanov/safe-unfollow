#!/usr/bin/env bash
# Copy the rows the old instance recorded after the full copy into the local database.
#
#   bin/sync-delta.sh                          # since dumps/last-dump-started-at
#   bin/sync-delta.sh 2026-11-02T10:00:00Z     # since an explicit moment
#
# DNS for the tracker host does not flip everywhere at once: for a while some
# visitors still reach Vercel, which keeps writing to Supabase. This closes that
# gap. It is idempotent — rows are matched on their primary key and existing ones
# are skipped — so it is safe to run repeatedly, and safe to run while the new
# instance is live and writing rows of its own.
#
# Rows are copied column-for-column, which is only valid while both databases sit
# on the same Umami schema version. Do not upgrade the local Umami before the last run.

# shellcheck source=bin/_lib.sh
source "$(dirname "$0")/_lib.sh"

require SOURCE_DATABASE_URL

since=${1:-$(cat dumps/last-dump-started-at 2>/dev/null || true)}
[ -n "$since" ] || die "no start time given and dumps/last-dump-started-at is missing — run bin/migrate.sh first"

# Interpolated into SQL below, so it must be a plain timestamp and nothing else.
[[ $since =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}[T\ ][0-9]{2}:[0-9]{2}(:[0-9]{2})?(Z|[+-][0-9]{2}(:?[0-9]{2})?)?$ ]] ||
  die "not a timestamp: $since (expected e.g. 2026-11-02T10:00:00Z)"

# Every Umami table that collection writes to and that carries created_at.
# Tables an older schema does not have are skipped.
tables=(session session_data session_link website_event event_data revenue session_replay heatmap_event)

log "Copying rows created at or after $since"
for table in "${tables[@]}"; do
  if [ "$(psql_local -tAc "select to_regclass('public.$table') is not null")" != t ] ||
    [ "$(psql_source -tAc "select to_regclass('public.$table') is not null")" != t ]; then
    printf '  %-15s skipped (not in this schema version)\n' "$table"
    continue
  fi

  file=/dumps/delta-$table.csv
  psql_source -q -c "\\copy (select * from public.$table where created_at >= '$since') to '$file' with (format csv)"

  inserted=$(psql_local -q -tA <<SQL
begin;
create temp table delta (like public.$table) on commit drop;
\\copy delta from '$file' with (format csv)
with inserted as (
  insert into public.$table select * from delta on conflict do nothing returning 1
)
select count(*) from inserted;
commit;
SQL
  )
  compose exec -T db rm -f "$file"
  printf '  %-15s %s new rows\n' "$table" "$inserted"
done

log "Done."
