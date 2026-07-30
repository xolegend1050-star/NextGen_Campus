const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getVerificationStatus = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT v.*
       FROM verifications v
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC`,
      [req.user.id]
    );

    const isEmailVerified = await db.query(
      'SELECT is_email_verified FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      isEmailVerified: isEmailVerified.rows[0].is_email_verified,
      verifications: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.submitVerification = async (req, res, next) => {
  try {
    const { verification_type, document_url, metadata } = req.body;

    // Determine tier based on verification type
    let tier;
    switch (verification_type) {
      case 'student_college_email':
      case 'alumni_linkedin':
      case 'company_domain':
        tier = 'tier1_auto';
        break;
      case 'student_id_card':
      case 'alumni_college_id':
      case 'company_gst':
        tier = 'tier2_manual';
        break;
      default:
        return res.status(400).json({ error: 'Invalid verification type' });
    }

    // Check for existing pending verification
    const existing = await db.query(
      `SELECT id FROM verifications 
       WHERE user_id = $1 AND verification_type = $2 AND status = 'pending'`,
      [req.user.id, verification_type]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending verification of this type' });
    }

    const result = await db.query(
      `INSERT INTO verifications (user_id, verification_type, tier, document_url, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, verification_type, tier, document_url || null, JSON.stringify(metadata || {})]
    );

    // For tier1 auto-verification, check and auto-approve
    if (tier === 'tier1_auto') {
      // Auto-approve college email verification
      if (verification_type === 'student_college_email') {
        const email = req.user.email;
        const domain = email.split('@')[1];

        // Check if domain is a known college domain
        // For demo purposes, auto-approve
        await db.query(
          `UPDATE verifications SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
          [result.rows[0].id]
        );

        await db.query('UPDATE users SET is_email_verified = true WHERE id = $1', [req.user.id]);

        logger.info(`Auto-verification approved for user ${req.user.id}`);
      }
    }

    logger.info(`Verification submitted: ${result.rows[0].id} (${verification_type})`);
    res.status(201).json({ verification: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    const result = await db.query(
      `SELECT * FROM verification_tokens 
       WHERE token = $1 AND user_id = $2 AND used = false AND expires_at > NOW()`,
      [token, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await db.query('UPDATE users SET is_email_verified = true WHERE id = $1', [req.user.id]);
    await db.query('UPDATE verification_tokens SET used = true WHERE token = $1', [token]);

    logger.info(`Email verified for user ${req.user.id}`);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};
