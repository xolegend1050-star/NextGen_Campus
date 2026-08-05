const crypto = require('crypto');
const db = require('../config/database');
const logger = require('./logger');

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_LENGTH = 6;

/**
 * Generate a 6-digit numeric OTP code
 */
function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store OTP in database for a user
 * Returns the OTP code (for dev logging) and expires_at
 */
async function storeOtp(userId) {
  // Invalidate any existing unverified OTPs for this user
  await db.query(
    'DELETE FROM login_otps WHERE user_id = $1 AND verified = false',
    [userId]
  );

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.query(
    `INSERT INTO login_otps (user_id, otp_code, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4)`,
    [userId, code, expiresAt, OTP_MAX_ATTEMPTS]
  );

  logger.info(`OTP generated for user ${userId}, expires at ${expiresAt}`);

  return { code, expiresAt };
}

/**
 * Verify an OTP code for a user
 * Returns { success, error?, userId? }
 */
async function verifyOtp(userId, otpCode) {
  const result = await db.query(
    `SELECT id, otp_code, expires_at, attempts, max_attempts, verified
     FROM login_otps
     WHERE user_id = $1 AND verified = false
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { success: false, error: 'No OTP found. Please request a new one.' };
  }

  const otp = result.rows[0];

  // Check if already verified
  if (otp.verified) {
    return { success: false, error: 'OTP already used. Please request a new one.' };
  }

  // Check expiry
  if (new Date() > new Date(otp.expires_at)) {
    await db.query('DELETE FROM login_otps WHERE id = $1', [otp.id]);
    return { success: false, error: 'OTP expired. Please request a new one.' };
  }

  // Check max attempts
  if (otp.attempts >= otp.max_attempts) {
    await db.query('DELETE FROM login_otps WHERE id = $1', [otp.id]);
    return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
  }

  // Increment attempts
  await db.query(
    'UPDATE login_otps SET attempts = attempts + 1 WHERE id = $1',
    [otp.id]
  );

  // Check code match
  if (otp.otp_code !== otpCode) {
    return { success: false, error: `Invalid OTP. ${otp.max_attempts - otp.attempts - 1} attempts remaining.` };
  }

  // Mark as verified
  await db.query(
    'UPDATE login_otps SET verified = true WHERE id = $1',
    [otp.id]
  );

  logger.info(`OTP verified for user ${userId}`);

  return { success: true, userId };
}

module.exports = { generateOtpCode, storeOtp, verifyOtp, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS };
