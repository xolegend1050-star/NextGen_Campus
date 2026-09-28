-- =====================================================
-- Notification enum values the backend writes but the enum lacks
-- =====================================================
-- followController inserts 'new_follower' and mentorshipController inserts
-- 'session_scheduled'. Neither existed in the notification_type enum, so
-- Postgres rejected the insert with
--   invalid input value for enum notification_type: "new_follower"
-- Following a user and scheduling a mentorship session therefore failed
-- outright. Safe to run more than once.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'new_follower') THEN
    ALTER TYPE notification_type ADD VALUE 'new_follower';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'session_scheduled') THEN
    ALTER TYPE notification_type ADD VALUE 'session_scheduled';
  END IF;
END $$;

-- =====================================================
-- Verify
-- =====================================================
-- SELECT enumlabel FROM pg_enum
--  WHERE enumtypid = 'notification_type'::regtype ORDER BY enumsortorder;
