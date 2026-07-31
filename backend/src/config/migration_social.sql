-- Migration: Add social features (follows, online presence, DM)

-- 1. Add last_seen_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- 2. Add 'dm' to conversation_type ENUM
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dm' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'conversation_type')) THEN
    ALTER TYPE conversation_type ADD VALUE 'dm';
  END IF;
END $$;

-- 3. Create follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 4. Add follow count columns to profiles (denormalized for fast queries)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- 5. Trigger to auto-update follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
        UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles SET following_count = following_count - 1 WHERE user_id = OLD.follower_id;
        UPDATE profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.following_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON follows;
CREATE TRIGGER trigger_update_follow_counts
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts();
