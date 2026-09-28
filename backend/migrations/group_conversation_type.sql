-- =====================================================
-- Add 'group' conversation type
-- =====================================================
-- createConversation used type 'group' for conversations with more than two
-- participants, but conversation_type had no such value, so Postgres rejected
-- the insert with:
--   invalid input value for enum conversation_type: "group"
-- Every group chat creation failed with a 500. Safe to run more than once.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'conversation_type'::regtype
                   AND enumlabel = 'group') THEN
    ALTER TYPE conversation_type ADD VALUE 'group';
  END IF;
END $$;

-- =====================================================
-- Verify
-- =====================================================
-- SELECT enumlabel FROM pg_enum
--  WHERE enumtypid = 'conversation_type'::regtype ORDER BY enumsortorder;
