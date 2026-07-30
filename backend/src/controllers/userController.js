const db = require('../config/database');
const logger = require('../utils/logger');

exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, email, role, is_active, is_banned, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) FROM users';
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    if (search) {
      conditions.push(`email ILIKE $${params.length + 1}`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [users, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      users: users.rows,
      pagination: {
        total: parseInt(count.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count.rows[0].count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.email, u.role, u.is_email_verified, u.is_active, u.is_banned,
              u.created_at, u.last_login_at,
              p.full_name, p.avatar_url, p.bio, p.city, p.college_name, p.skills,
              p.trust_score, p.talent_tier
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, is_active } = req.body;

    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email && req.user.role === 'admin') {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (is_active !== undefined && req.user.role === 'admin') {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, email, role, is_active, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User updated: ${id}`);
    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User deleted: ${id}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    const result = await db.query(
      `UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2
       RETURNING id, email, is_banned`,
      [reason, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, reason)
       VALUES ($1, 'ban_user', $2, $3)`,
      [req.user.id, id, reason]
    );

    logger.info(`User banned: ${id} by admin ${req.user.id}`);
    res.json({ message: 'User banned successfully', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
