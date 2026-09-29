-- =====================================================
-- Notification types for deliverables and withdrawal decisions
-- =====================================================
-- Three new notifications are raised by the payment work:
--
--   deliverable_submitted  a student hands over the work for a gig, so the
--                          company knows it can now release escrow
--   withdrawal_approved    an administrator paid a withdrawal out
--   withdrawal_rejected    an administrator turned one down, so the amount goes
--                          back to the user's available balance
--
-- notifications.type is an enum, so inserting any of these without the value
-- present raised:
--   invalid input value for enum notification_type: "deliverable_submitted"
--
-- In processWithdrawal that failure would roll the whole approval back, leaving
-- the request pending and the money locked - the exact state the migration is
-- meant to make reachable in the first place.
--
-- Safe to run more than once.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'deliverable_submitted') THEN
    ALTER TYPE notification_type ADD VALUE 'deliverable_submitted';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'withdrawal_approved') THEN
    ALTER TYPE notification_type ADD VALUE 'withdrawal_approved';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'withdrawal_rejected') THEN
    ALTER TYPE notification_type ADD VALUE 'withdrawal_rejected';
  END IF;
END $$;

-- =====================================================
-- Verify
-- =====================================================
-- SELECT enumlabel FROM pg_enum
--  WHERE enumtypid = 'notification_type'::regtype
--    AND (enumlabel LIKE 'deliverable%' OR enumlabel LIKE 'withdrawal%');
