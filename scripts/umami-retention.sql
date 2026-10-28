-- Umami analytics retention.
-- Deletes data older than :retention_days days (default 90) and reclaims space.
-- Idempotent and safe to re-run: used by the one-time cleanup, by the
-- weekly .github/workflows/umami-cleanup.yml workflow, and on the VPS by
-- infra/umami/bin/retention.sh (psql -v retention_days=N).
-- There are no FK constraints between these tables, so each is deleted
-- independently; all three have a btree index on created_at.

\set ON_ERROR_STOP on

\if :{?retention_days}
\else
  \set retention_days 90
\endif

DELETE FROM event_data
WHERE created_at < now() - make_interval(days => :retention_days);

DELETE FROM website_event
WHERE created_at < now() - make_interval(days => :retention_days);

DELETE FROM session s
WHERE s.created_at < now() - make_interval(days => :retention_days)
  AND NOT EXISTS (
    SELECT 1 FROM website_event we WHERE we.session_id = s.session_id
  );

-- VACUUM runs outside a transaction; psql autocommits each statement.
VACUUM (ANALYZE) event_data;
VACUUM (ANALYZE) website_event;
VACUUM (ANALYZE) session;
