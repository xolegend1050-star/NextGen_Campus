-- Migration: Add performance indexes for verification and related tables
-- Run after database.sql seed

-- Verification lookup indexes
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_verifications_user_status ON verifications(user_id, status);

-- Trust score history indexes
CREATE INDEX IF NOT EXISTS idx_trust_history_user_id ON trust_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_created_at ON trust_score_history(created_at);

-- Profiles talent tier index (for leaderboard filtering)
CREATE INDEX IF NOT EXISTS idx_profiles_talent_tier ON profiles(talent_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score DESC);

-- Doubt answers author index (for trust score calculation)
CREATE INDEX IF NOT EXISTS idx_doubt_answers_author ON doubt_answers(author_id);

-- Ratings rated user index
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON ratings(rated_id);

-- Flagged content status index
CREATE INDEX IF NOT EXISTS idx_flagged_status ON flagged_content(status);

-- Auto-update verified_at timestamp on verification approval
CREATE OR REPLACE FUNCTION update_verified_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.verified_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verified_at ON verifications;
CREATE TRIGGER trigger_verified_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_verified_at();
