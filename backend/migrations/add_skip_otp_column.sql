-- =====================================================
-- Migration: Add skip_otp column to users table
-- Existing dummy accounts (student, mentor, admin) will have skip_otp = true
-- New registrations will have skip_otp = false (default)
-- =====================================================

-- Add skip_otp column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS skip_otp BOOLEAN DEFAULT FALSE;

-- Set skip_otp = true for existing dummy accounts (student, mentor, admin)
-- These accounts have inaccessible emails, so OTP would lock them out
UPDATE users SET skip_otp = true WHERE role IN ('student', 'alumni', 'admin');

-- Company accounts will NOT have skip_otp = true (they need OTP)
-- New student/mentor registrations will also need OTP

-- Verify the change
SELECT id, email, role, skip_otp FROM users ORDER BY created_at;
