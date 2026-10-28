#!/usr/bin/env bash
# Nightly dump of the local database to Cloudflare R2.
#
# Keeps the last three days on the VPS for a fast restore; R2 holds the history,
# and how long it holds it is the bucket's lifecycle rule (see README.md), not
# this script's concern.
#
# Restore: docker compose stop cloudflared umami
#          docker compose exec -T db pg_restore -U umami -d umami --clean --if-exists /dumps/<file>
#          docker compose up -d

# shellcheck source=bin/_lib.sh
source "$(dirname "$0")/_lib.sh"

require R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY

mkdir -p dumps
name=umami-$(date -u +%Y%m%dT%H%M%SZ).dump

log "Dumping to dumps/$name"
compose exec -T db pg_dump -U umami -d umami --format=custom --file "/dumps/$name"

log "Uploading to r2://$R2_BUCKET/$name"
# The checksum settings keep newer AWS CLI releases compatible with R2.
docker run --rm \
  -v "$PWD/dumps:/dumps:ro" \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
  -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  amazon/aws-cli:2.38.6 \
  s3 cp "/dumps/$name" "s3://$R2_BUCKET/$name" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" --only-show-errors

find dumps -name 'umami-*.dump' -mtime +3 -delete

log "Done."
