-- =====================================================
-- Add missing updated_at to notifications
-- =====================================================
-- notifications carries a BEFORE UPDATE trigger that calls
-- update_updated_at_column(), but the table has no updated_at column. Every
-- UPDATE therefore failed with
--   record "new" has no field "updated_at"
-- which broke marking notifications as read (both the single-message route and
-- read-all returned 500). It only appeared to work when an UPDATE matched zero
-- rows, because the trigger never fired.
--
-- Every other timestamped table in this schema has the column, so this is a
-- straight omission rather than an intentional design. Safe to run more than
-- once.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- Verify: updating a notification should no longer raise
-- =====================================================
-- SELECT id, is_read, updated_at FROM notifications ORDER BY created_at DESC LIMIT 5;
