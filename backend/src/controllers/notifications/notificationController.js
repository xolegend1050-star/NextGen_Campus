const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
    const params = [req.user.id];

    if (unread_only === 'true') {
      query += ' AND is_read = false';
      countQuery += ' AND is_read = false';
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [notifications, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      notifications: notifications.rows,
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

exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

exports.getPreferences = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Create default preferences
      const newPrefs = await db.query(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
      return res.json({ preferences: newPrefs.rows[0] });
    }

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const {
      email_notifications, push_notifications, in_app_notifications,
      doubt_notifications, mentorship_notifications, gig_notifications,
      payment_notifications, system_notifications,
      quiet_hours_start, quiet_hours_end
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email_notifications !== undefined) {
      updates.push(`email_notifications = $${paramCount}`);
      values.push(email_notifications);
      paramCount++;
    }
    if (push_notifications !== undefined) {
      updates.push(`push_notifications = $${paramCount}`);
      values.push(push_notifications);
      paramCount++;
    }
    if (in_app_notifications !== undefined) {
      updates.push(`in_app_notifications = $${paramCount}`);
      values.push(in_app_notifications);
      paramCount++;
    }
    if (doubt_notifications !== undefined) {
      updates.push(`doubt_notifications = $${paramCount}`);
      values.push(doubt_notifications);
      paramCount++;
    }
    if (mentorship_notifications !== undefined) {
      updates.push(`mentorship_notifications = $${paramCount}`);
      values.push(mentorship_notifications);
      paramCount++;
    }
    if (gig_notifications !== undefined) {
      updates.push(`gig_notifications = $${paramCount}`);
      values.push(gig_notifications);
      paramCount++;
    }
    if (payment_notifications !== undefined) {
      updates.push(`payment_notifications = $${paramCount}`);
      values.push(payment_notifications);
      paramCount++;
    }
    if (system_notifications !== undefined) {
      updates.push(`system_notifications = $${paramCount}`);
      values.push(system_notifications);
      paramCount++;
    }
    if (quiet_hours_start !== undefined) {
      updates.push(`quiet_hours_start = $${paramCount}`);
      values.push(quiet_hours_start);
      paramCount++;
    }
    if (quiet_hours_end !== undefined) {
      updates.push(`quiet_hours_end = $${paramCount}`);
      values.push(quiet_hours_end);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(req.user.id);
    const result = await db.query(
      `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      // Create preferences if they don't exist
      const newPrefs = await db.query(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
      return res.json({ preferences: newPrefs.rows[0] });
    }

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
