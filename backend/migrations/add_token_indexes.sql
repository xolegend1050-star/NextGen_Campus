-- =====================================================
-- Add indexes on hashed-token columns
-- =====================================================
-- Every authenticated request looks up user_sessions.token_hash, and token
-- refresh / password reset / email verification each look up their own
-- hashed token. Without indexes these are full table scans.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- Run in the Supabase SQL Editor.
-- =====================================================

-- Lookup on every authenticated request (middleware/auth.js)
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
    ON user_sessions (token_hash);

-- Lookup on token refresh (authController.refreshToken)
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_hash
    ON user_sessions (refresh_token_hash);

-- Lookup when consuming a password reset link
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash
    ON password_resets (token_hash);

-- Invalidate all outstanding reset tokens for a user (forgotPassword)
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id_used
    ON password_resets (user_id, used);

-- Session lookups scoped to a user (logout-all, profile sessions)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON user_sessions (user_id);

-- Expired-row cleanup sweeps on user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
    ON user_sessions (expires_at);

-- =====================================================
-- Optional: tighten token_hash columns
-- =====================================================
-- SHA-256 hex output is always 64 characters, so VARCHAR(255) wastes space.
-- Uncomment to shrink. Safe because no existing value can exceed 64 chars.
--
-- ALTER TABLE user_sessions  ALTER COLUMN token_hash TYPE VARCHAR(64);
-- ALTER TABLE user_sessions  ALTER COLUMN refresh_token_hash TYPE VARCHAR(64);
-- ALTER TABLE password_resets ALTER COLUMN token_hash TYPE VARCHAR(64);
--
-- =====================================================
-- Verify
-- =====================================================
-- SELECT indexname, tablename FROM pg_indexes
--  WHERE indexname LIKE 'idx_%token%' OR indexname LIKE 'idx_user_sessions%';
