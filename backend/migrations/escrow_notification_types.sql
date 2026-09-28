-- =====================================================
-- Add escrow notification types
-- =====================================================
-- notifications.type is an enum that had no value for an escrow being funded
-- or refunded, so inserting those raised:
--   invalid input value for enum notification_type: "escrow_funded"
-- The whole funding transaction aborted with it, so escrow could never start.
-- Safe to run more than once.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'escrow_funded') THEN
    ALTER TYPE notification_type ADD VALUE 'escrow_funded';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'notification_type'::regtype
                   AND enumlabel = 'escrow_refunded') THEN
    ALTER TYPE notification_type ADD VALUE 'escrow_refunded';
  END IF;
END $$;

-- wallet_transactions.transaction_type already has 'refund', which is what the
-- refund path uses; no enum change needed there.

-- =====================================================
-- Verify
-- =====================================================
-- SELECT enumlabel FROM pg_enum
--  WHERE enumtypid = 'notification_type'::regtype
--    AND enumlabel LIKE 'escrow%';
