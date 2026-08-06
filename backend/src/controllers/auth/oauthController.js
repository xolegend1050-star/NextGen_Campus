const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const logger = require('../../utils/logger');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
  return { token, refreshToken };
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { code, credential, role } = req.body;

    let email, name, picture, googleId;

    if (code) {
      // Authorization code flow (redirect-based OAuth)
      let tokenResponse;
      try {
        tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${(process.env.FRONTEND_URL || 'http://localhost:3000').trim()}/login`,
            grant_type: 'authorization_code'
          })
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to connect to Google' });
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return res.status(401).json({ error: 'Google authentication failed', details: tokenData.error_description });
      }

      // Decode the id_token to get user info
      try {
        const parts = tokenData.id_token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (err) {
        return res.status(400).json({ error: 'Failed to decode Google token' });
      }
    } else if (credential) {
      // Credential flow (Google Identity Services SDK)
      // Verify the JWT with Google's tokeninfo endpoint
      try {
        const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!verifyResponse.ok) {
          return res.status(401).json({ error: 'Invalid Google credential — verification failed' });
        }
        const payload = await verifyResponse.json();
        if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
          return res.status(401).json({ error: 'Google credential audience mismatch' });
        }
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (err) {
        return res.status(400).json({ error: 'Invalid Google credential' });
      }
    } else {
      return res.status(400).json({ error: 'Google authorization code or credential is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email not available from Google account' });
    }

    // Check if user exists by email
    let result = await db.query(
      'SELECT id, email, role, auth_provider, is_active, is_banned FROM users WHERE email = $1',
      [email]
    );

    let user;

    if (result.rows.length > 0) {
      // User exists — check if they already have a different auth provider
      user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      if (user.is_banned) {
        return res.status(403).json({ error: 'Account has been banned' });
      }

      // Link Google if they registered with email
      if (user.auth_provider === 'email') {
        await db.query(
          `UPDATE users SET auth_provider = 'google', provider_id = $1 WHERE id = $2`,
          [googleId, user.id]
        );
        logger.info(`Linked Google account to existing user: ${email}`);
      }
    } else {
      // New user — create account
      const userRole = role || 'student';
      const randomPassword = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);

      result = await db.query(
        `INSERT INTO users (email, password_hash, role, auth_provider, provider_id, is_email_verified)
         VALUES ($1, $2, $3, 'google', $4, true)
         RETURNING id, email, role`,
        [email, randomPassword, userRole, googleId]
      );
      user = result.rows[0];

      // Create profile
      if (userRole === 'student' || userRole === 'alumni') {
        await db.query(
          `INSERT INTO profiles (user_id, full_name, avatar_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)`,
          [user.id, name || '', picture || null]
        );
      } else if (userRole === 'company') {
        await db.query(
          `INSERT INTO company_profiles (user_id, company_name)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name`,
          [user.id, name || '']
        );
      }

      logger.info(`New user registered via Google: ${email} (${userRole})`);
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Store session (hash tokens)
    await db.query(
      `INSERT INTO user_sessions (user_id, token_hash, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(tokens.token), hashToken(tokens.refreshToken)]
    );

    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'Google login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token: tokens.token,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.githubLogin = async (req, res, next) => {
  try {
    const { code, role } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'GitHub authorization code is required' });
    }

    // Exchange code for access token
    let tokenResponse;
    try {
      tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        })
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to connect to GitHub' });
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(401).json({ error: 'GitHub authentication failed', details: tokenData.error_description });
    }

    // Fetch GitHub user profile
    let githubUser;
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      githubUser = await userResponse.json();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch GitHub profile' });
    }

    // Get user email (GitHub may require a separate call for private emails)
    let email = githubUser.email;
    if (!email) {
      try {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/vnd.github+json'
          }
        });
        const emails = await emailsResponse.json();
        const primary = emails.find(e => e.primary && e.verified);
        email = primary ? primary.email : emails.find(e => e.verified)?.email;
      } catch (err) {
        // Continue without email
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from GitHub. Please make your email public or verify it.' });
    }

    const githubId = String(githubUser.id);
    const name = githubUser.name || githubUser.login;

    // Check if user exists
    let result = await db.query(
      'SELECT id, email, role, auth_provider, is_active, is_banned FROM users WHERE email = $1',
      [email]
    );

    let user;

    if (result.rows.length > 0) {
      user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      if (user.is_banned) {
        return res.status(403).json({ error: 'Account has been banned' });
      }

      // Link GitHub if they registered with email
      if (user.auth_provider === 'email') {
        await db.query(
          `UPDATE users SET auth_provider = 'github', provider_id = $1 WHERE id = $2`,
          [githubId, user.id]
        );
        logger.info(`Linked GitHub account to existing user: ${email}`);
      }
    } else {
      // New user
      const userRole = role || 'student';
      const randomPassword = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);

      result = await db.query(
        `INSERT INTO users (email, password_hash, role, auth_provider, provider_id, is_email_verified)
         VALUES ($1, $2, $3, 'github', $4, true)
         RETURNING id, email, role`,
        [email, randomPassword, userRole, githubId]
      );
      user = result.rows[0];

      if (userRole === 'student' || userRole === 'alumni') {
        await db.query(
          `INSERT INTO profiles (user_id, full_name, avatar_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)`,
          [user.id, name, githubUser.avatar_url || null]
        );
      } else if (userRole === 'company') {
        await db.query(
          `INSERT INTO company_profiles (user_id, company_name)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name`,
          [user.id, name]
        );
      }

      logger.info(`New user registered via GitHub: ${email} (${userRole})`);
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    await db.query(
      `INSERT INTO user_sessions (user_id, token_hash, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, tokens.token, tokens.refreshToken]
    );

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'GitHub login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token: tokens.token,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    next(error);
  }
};
