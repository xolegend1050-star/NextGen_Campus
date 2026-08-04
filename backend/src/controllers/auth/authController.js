const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../../utils/email');

const generateTokens = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
  return { token, refreshToken };
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, role, full_name, phone, city, college_name } = req.body;

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.json({
        message: 'If this email is not registered, a verification link has been sent.',
        user: null,
        token: null,
        refreshToken: null
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, is_email_verified)
       VALUES ($1, $2, $3, $4) RETURNING id, email, role, created_at`,
      [email, password_hash, role, false]
    );

    const user = result.rows[0];

    // Create profile based on role (use ON CONFLICT DO UPDATE to overwrite empty trigger-created rows)
    if (role === 'student' || role === 'alumni') {
      await db.query(
        `INSERT INTO profiles (user_id, full_name, phone, city, college_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
           phone = COALESCE(EXCLUDED.phone, profiles.phone),
           city = COALESCE(NULLIF(EXCLUDED.city, ''), profiles.city),
           college_name = COALESCE(NULLIF(EXCLUDED.college_name, ''), profiles.college_name)`,
        [user.id, full_name, phone || null, city || null, college_name || null]
      );
    } else if (role === 'company') {
      await db.query(
        `INSERT INTO company_profiles (user_id, company_name)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name`,
        [user.id, full_name]
      );
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id);

    // Store session
    await db.query(
      `INSERT INTO user_sessions (user_id, token_hash, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, token, refreshToken]
    );

    // Determine verification type based on role
    const verificationTypeMap = {
      student: 'student_college_email',
      alumni: 'alumni_linkedin',
      company: 'company_domain'
    };
    const verificationType = verificationTypeMap[role] || 'student_college_email';

    // Generate email verification token
    const verificationToken = uuidv4();
    await db.query(
      `INSERT INTO verification_tokens (user_id, token, verification_type, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
      [user.id, verificationToken, verificationType]
    );

    logger.info(`New user registered: ${email} (${role})`);

    // Send verification email (non-blocking)
    sendVerificationEmail(email, verificationToken).catch(err => {
      logger.warn('Verification email failed (non-blocking):', err.message);
    });

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Get user
    const result = await db.query(
      'SELECT id, email, password_hash, role, is_active, is_banned FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account has been banned' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id);

    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Store session
    await db.query(
      `INSERT INTO user_sessions (user_id, token_hash, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, token, refreshToken]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'company') {
      result = await db.query(
        `SELECT u.id, u.email, u.role, u.is_email_verified, u.created_at,
                cp.company_name, cp.industry, cp.website_url, cp.is_verified, cp.trust_score
         FROM users u
         LEFT JOIN company_profiles cp ON u.id = cp.user_id
         WHERE u.id = $1`,
        [req.user.id]
      );
    } else {
      result = await db.query(
        `SELECT u.id, u.email, u.role, u.is_email_verified, u.created_at,
                p.full_name, p.avatar_url, p.city, p.college_name, p.trust_score, p.talent_tier
         FROM users u
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE u.id = $1`,
        [req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const userId = result.rows[0].id;
    const resetToken = uuidv4();

    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, resetToken]
    );

    // Send email with reset link (non-blocking)
    sendPasswordResetEmail(email, resetToken).catch(err => {
      logger.warn('Password reset email failed (non-blocking):', err.message);
    });
    logger.info(`Password reset requested for: ${email}`);

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const result = await db.query(
      `SELECT user_id FROM password_resets
       WHERE token_hash = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const userId = result.rows[0].user_id;
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Update password
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);

    // Mark token as used
    await db.query('UPDATE password_resets SET used = true WHERE token_hash = $1', [token]);

    // Invalidate all sessions
    await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    logger.info(`Password reset completed for user: ${userId}`);

    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    const result = await db.query(
      `SELECT user_id FROM verification_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    const userId = result.rows[0].user_id;

    await db.query('UPDATE users SET is_email_verified = true WHERE id = $1', [userId]);
    await db.query('UPDATE verification_tokens SET used = true WHERE token = $1', [token]);

    logger.info(`Email verified for user: ${userId}`);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [token]);

    logger.info(`User logged out: ${req.user.id}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Check session exists
    const session = await db.query(
      'SELECT * FROM user_sessions WHERE refresh_token_hash = $1',
      [refreshToken]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Check user is still active
    const user = await db.query(
      'SELECT id, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (user.rows.length === 0 || !user.rows[0].is_active || user.rows[0].is_banned) {
      return res.status(401).json({ error: 'Account unavailable' });
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    // Update session
    await db.query(
      `UPDATE user_sessions
       SET token_hash = $1, refresh_token_hash = $2, expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $3`,
      [tokens.token, tokens.refreshToken, session.rows[0].id]
    );

    logger.info(`Token refreshed for user: ${decoded.userId}`);

    res.json({
      token: tokens.token,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserBadges = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.id, b.name, b.description, b.icon_url, b.points_value, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [req.user.id]
    );
    res.json({ badges: result.rows });
  } catch (error) {
    next(error);
  }
};
