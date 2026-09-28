-- =====================================================
-- Escrow hardening
-- =====================================================
-- Problem: escrow_transactions is keyed only by gig_id, and fundEscrow never
-- populated student_id. releaseEscrow then looked up a wallet for user_id
-- NULL, so the payout could never happen. A company accepting several students
-- on one gig also had no way to fund each of them separately.
--
-- Fix: tie escrow to a specific accepted application, and stop negative or
-- zero amounts from being funded (balance - (-100) credits the company).
-- Safe to run more than once.
-- =====================================================

-- 1. Link escrow to the application it is funding
ALTER TABLE escrow_transactions
    ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES gig_applications(id) ON DELETE SET NULL;

-- 2. Track a refund explicitly instead of overloading 'cancelled'
ALTER TABLE escrow_transactions
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE escrow_transactions
    ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- 3. Reject non-positive and absurd amounts at the database level
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escrow_amount_positive') THEN
    ALTER TABLE escrow_transactions
      ADD CONSTRAINT escrow_amount_positive CHECK (amount > 0 AND amount <= 10000000);
  END IF;
END $$;

-- 4. At most one live escrow per application
CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_one_locked_per_application
    ON escrow_transactions (application_id)
    WHERE application_id IS NOT NULL AND status = 'locked';

-- 5. Indexes for the hot lookups
CREATE INDEX IF NOT EXISTS idx_escrow_company_status
    ON escrow_transactions (company_id, status);

CREATE INDEX IF NOT EXISTS idx_escrow_student_status
    ON escrow_transactions (student_id, status);

CREATE INDEX IF NOT EXISTS idx_escrow_gig_status
    ON escrow_transactions (gig_id, status);

CREATE INDEX IF NOT EXISTS idx_escrow_auto_release
    ON escrow_transactions (auto_release_at)
    WHERE status = 'locked';

-- 6. Backfill student_id for any legacy rows that still have NULL
UPDATE escrow_transactions e
   SET student_id = a.student_id
  FROM gig_applications a
 WHERE e.application_id IS NULL
   AND e.student_id IS NULL
   AND a.gig_id = e.gig_id
   AND a.status = 'accepted'
   AND NOT EXISTS (
     SELECT 1 FROM gig_applications a2
      WHERE a2.gig_id = e.gig_id AND a2.status = 'accepted' AND a2.student_id <> a.student_id
   );

-- =====================================================
-- Verify
-- =====================================================
-- SELECT id, gig_id, application_id, student_id, amount, status
--   FROM escrow_transactions ORDER BY created_at DESC;
