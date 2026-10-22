const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Same digest the auth controller writes and reads. It is duplicated rather than
// imported because every module that touches tokens already defines it locally.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const { analyzeIDCard } = require('../../utils/ocr');
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

    // Validate role-to-type mapping
    const ROLE_TYPE_MAP = {
      student: ['student_college_email', 'student_id_card'],
      alumni: ['alumni_linkedin', 'alumni_college_id'],
      company: ['company_domain', 'company_gst']
    };
    if (!ROLE_TYPE_MAP[req.user.role]?.includes(verification_type)) {
      return res.status(403).json({ error: 'Verification type not allowed for your role' });
    }

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

    // Require document for tier2 types
    if (tier === 'tier2_manual' && !document_url) {
      return res.status(400).json({ error: 'Document URL is required for this verification type' });
    }

    // Validate document URL is from our upload endpoint
    if (document_url && !document_url.startsWith('/uploads/verification/')) {
      return res.status(400).json({ error: 'Invalid document URL' });
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

    // Validate company domain email
    if (verification_type === 'company_domain') {
      if (!metadata?.company_email || !metadata.company_email.includes('@')) {
        return res.status(400).json({ error: 'Valid company email is required' });
      }
      const domain = metadata.company_email.split('@')[1]?.toLowerCase();
      // Reject free email providers for company verification
      const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
      if (freeProviders.includes(domain)) {
        return res.status(400).json({ error: 'Please use your company email, not a personal email' });
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

    // Run OCR on student ID card uploads for admin review labels
    if (verification_type === 'student_id_card' && document_url) {
      try {
        const filePath = path.join(__dirname, '../../uploads/verification', path.basename(document_url));
        if (fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath);
          const profileResult = await db.query('SELECT full_name FROM profiles WHERE user_id = $1', [req.user.id]);
          const profileName = profileResult.rows[0]?.full_name || null;

          const ocrResult = await analyzeIDCard(imageBuffer, profileName);

          await db.query(
            'UPDATE verifications SET ocr_result = $1 WHERE id = $2',
            [JSON.stringify(ocrResult), result.rows[0].id]
          );

          result.rows[0].ocr_result = ocrResult;
          logger.info(`OCR completed for verification ${result.rows[0].id}: confidence=${ocrResult.confidence}%`);
        }
      } catch (ocrError) {
        logger.error('OCR processing failed (non-blocking):', ocrError.message);
      }
    }

    // Tier 1 does not mean "approve on submission". Both of these types are
    // proven by controlling an email address, so what happens here is that a
    // one-time link is sent and the verification is approved when it is clicked.
    //
    // company_domain used to be approved the moment it arrived. The address was
    // checked against a list of free mail providers and nothing else, so typing
    // ceo@flipkart.com earned the domain half of the Verified Company badge
    // without ever touching that mailbox, while the page claimed to have sent a
    // link and no link existed.
    let verifyLink = null;
    if (tier === 'tier1_auto') {
      const EMAIL_PROVEN_TYPES = ['student_college_email', 'company_domain'];

      if (EMAIL_PROVEN_TYPES.includes(verification_type)) {
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Stored as sha256, which is what /api/auth/verify-email looks up when the
        // link is clicked. It used to be stored raw, so the lookup hashed the token
        // being clicked, never matched the row written here, and every student
        // clicked through to "Invalid or expired verification link".
        await db.query(
          `INSERT INTO verification_tokens (user_id, token, verification_type, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, hashToken(token), verification_type, expiresAt]
        );

        verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

        const destination = verification_type === 'company_domain'
          ? metadata.company_email
          : (metadata.college_email || req.user.email);

        const sent = await sendVerificationEmail(destination, token);

        if (!sent) {
          // A verification left pending with no link in the holder's hand can never
          // be completed, and it blocks a retry because submission refuses a second
          // pending row of the same type. Rolling it back means a corrected address
          // or a working SENDGRID_API_KEY can simply be submitted again.
          await db.query('DELETE FROM verifications WHERE id = $1', [result.rows[0].id]);
          await db.query(
            'DELETE FROM verification_tokens WHERE user_id = $1 AND token = $2',
            [req.user.id, hashToken(token)]
          );
          logger.error(`Verification link not sent to ${destination}; submission rolled back`);
          return res.status(502).json({
            error: 'The verification link could not be sent. Check that SENDGRID_API_KEY is set on the API service, then submit again.'
          });
        }

        logger.info(`Verification link sent to ${destination} (${verification_type})`);
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

    const payload = { verification: result.rows[0] };

    // Outside production the link is returned alongside the record, because there
    // is no inbox to read while developing and otherwise the only way to see this
    // flow work end to end is to configure a mail provider first. It is withheld
    // in production deliberately: handing the link to the requester would let them
    // confirm an address they never received mail at, which is the exact hole this
    // change closes.
    if (verifyLink && process.env.NODE_ENV !== 'production') {
      payload.devLink = verifyLink;
    }

    res.status(201).json(payload);
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
