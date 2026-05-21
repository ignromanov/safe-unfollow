-- Umami analytics retention.
-- Deletes data older than 90 days and reclaims space.
-- Idempotent and safe to re-run: used by the one-time cleanup and by the
-- weekly .github/workflows/umami-cleanup.yml workflow.
-- There are no FK constraints between these tables, so each is deleted
-- independently; all three have a btree index on created_at.

\set ON_ERROR_STOP on

DELETE FROM event_data
WHERE created_at < now() - interval '90 days';

DELETE FROM website_event
WHERE created_at < now() - interval '90 days';

DELETE FROM session s
WHERE s.created_at < now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM website_event we WHERE we.session_id = s.session_id
  );

-- VACUUM runs outside a transaction; psql autocommits each statement.
VACUUM (ANALYZE) event_data;
VACUUM (ANALYZE) website_event;
VACUUM (ANALYZE) session;
