#!/usr/bin/env bash
# Delete analytics older than RETENTION_DAYS (default 90), weekly from cron.
#
# Runs the same scripts/umami-retention.sql the Supabase-era GitHub workflow ran,
# so this needs the repository checkout the README sets up, not just this folder.

# shellcheck source=bin/_lib.sh
source "$(dirname "$0")/_lib.sh"

sql=../../scripts/umami-retention.sql
[ -f "$sql" ] || die "$sql not found — run from the repository checkout"

days=${RETENTION_DAYS:-90}
[[ $days =~ ^[0-9]+$ ]] || die "RETENTION_DAYS must be a whole number of days, got: $days"

log "Deleting analytics older than $days days"
psql_local -v retention_days="$days" <"$sql"
log "Done."
