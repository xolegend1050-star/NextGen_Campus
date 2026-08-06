const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const {
  sendVerificationSubmittedEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendVerificationEmail
} = require('../../utils/email');

// Known college email domains (extend as needed)
const COLLEGE_DOMAINS = [
  '.edu', '.ac.in', '.edu.in', '.ac.uk', '.edu.au',
  'gmail.com', 'outlook.com' // For demo - remove in production
];

const LINKEDIN_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;

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

    // Validate college email domain
    if (verification_type === 'student_college_email' && metadata?.college_email) {
      const domain = metadata.college_email.split('@')[1]?.toLowerCase();
      const isCollegeDomain = COLLEGE_DOMAINS.some(d => domain?.endsWith(d));
      if (!isCollegeDomain) {
        return res.status(400).json({ error: 'Please use a valid college email address' });
      }
    }

    // Validate LinkedIn URL
    if (verification_type === 'alumni_linkedin' && metadata?.linkedin_url) {
      if (!LINKEDIN_REGEX.test(metadata.linkedin_url)) {
        return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
      }
    }

    const result = await db.query(
      `INSERT INTO verifications (user_id, verification_type, tier, document_url, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, verification_type, tier, document_url || null, JSON.stringify(metadata || {})]
    );

    // Tier 1 auto-verification logic
    if (tier === 'tier1_auto') {
      if (verification_type === 'student_college_email') {
        // Send verification email with token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await db.query(
          `INSERT INTO verification_tokens (user_id, token, verification_type, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, token, verification_type, expiresAt]
        );

        // Send verification email
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
        await sendVerificationEmail(
          metadata.college_email || req.user.email,
          token
        );

        logger.info(`Verification email sent to ${req.user.id}`);
      }

      if (verification_type === 'alumni_linkedin') {
        // LinkedIn URL validation is format-based, auto-approve
        await db.query(
          `UPDATE verifications SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
          [result.rows[0].id]
        );
        logger.info(`LinkedIn verification auto-approved for user ${req.user.id}`);
      }
    }

    logger.info(`Verification submitted: ${result.rows[0].id} (${verification_type})`);

    // Send submitted confirmation email (non-blocking)
    const profileResult = await db.query('SELECT full_name FROM profiles WHERE user_id = $1', [req.user.id]);
    const userName = profileResult.rows[0]?.full_name || null;
    sendVerificationSubmittedEmail(
      req.user.email,
      verification_type,
      userName
    ).catch(() => {});

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

    // Approve the verification
    const tokenData = result.rows[0];
    await db.query(
      `UPDATE verifications SET status = 'approved', reviewed_at = NOW()
       WHERE user_id = $1 AND verification_type = $2 AND status = 'pending'`,
      [req.user.id, tokenData.verification_type]
    );

    await db.query('UPDATE users SET is_email_verified = true WHERE id = $1', [req.user.id]);
    await db.query('UPDATE verification_tokens SET used = true WHERE token = $1', [token]);

    logger.info(`Email verified for user ${req.user.id}`);

    // Send approved email (non-blocking)
    const profileResult2 = await db.query('SELECT full_name FROM profiles WHERE user_id = $1', [req.user.id]);
    sendVerificationApprovedEmail(
      req.user.email,
      tokenData.verification_type,
      profileResult2.rows[0]?.full_name || null
    ).catch(() => {});

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};
