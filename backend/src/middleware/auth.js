const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT id, email, role, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account has been banned.' });
    }

    // Verify session still exists (logged-out tokens are invalid)
    const session = await db.query(
      'SELECT id FROM user_sessions WHERE token_hash = $1 AND expires_at > NOW()',
      [hashToken(token)]
    );
    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT id, email, role, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0 && result.rows[0].is_active && !result.rows[0].is_banned) {
      req.user = result.rows[0];
    }
  } catch (error) {
    // Continue without authentication
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
