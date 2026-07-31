const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.followUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetUser = await db.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [userId]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = await db.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already following' });
    }

    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [req.user.id, userId]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'new_follower', 'New Follower', $2, $3)`,
      [userId, 'Someone started following you', JSON.stringify({ follower_id: req.user.id })]
    );

    logger.info(`User ${req.user.id} followed ${userId}`);
    res.json({ message: 'Now following' });
  } catch (error) {
    next(error);
  }
};

exports.unfollowUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Not following this user' });
    }

    logger.info(`User ${req.user.id} unfollowed ${userId}`);
    res.json({ message: 'Unfollowed' });
  } catch (error) {
    next(error);
  }
};

exports.getFollowStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const [following, followers] = await Promise.all([
      db.query('SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, userId]),
      db.query('SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2', [userId, req.user.id])
    ]);

    res.json({
      is_following: following.rows.length > 0,
      is_followed_by: followers.rows.length > 0,
      is_mutual: following.rows.length > 0 && followers.rows.length > 0
    });
  } catch (error) {
    next(error);
  }
};

exports.getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT u.id, u.email,
              p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
              p.skills, p.trust_score, p.talent_tier,
              f.created_at as followed_at,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $3 AND following_id = u.id) as i_follow_them
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE f.following_id = $1 AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, limit, req.user.id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.following_id = $1 AND u.is_active = true',
      [userId]
    );

    res.json({
      followers: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT u.id, u.email,
              p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
              p.skills, p.trust_score, p.talent_tier,
              f.created_at as followed_at,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $3 AND following_id = u.id) as they_follow_me
       FROM follows f
       JOIN users u ON f.following_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE f.follower_id = $1 AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, limit, req.user.id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM follows f JOIN users u ON f.following_id = u.id WHERE f.follower_id = $1 AND u.is_active = true',
      [userId]
    );

    res.json({
      following: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const result = await db.query(
      `SELECT u.id, u.email,
              p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
              p.skills, p.trust_score, p.talent_tier,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) as i_follow_them,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id != $2 AND u.is_active = true AND u.is_banned = false
         AND NOT EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id)
       ORDER BY p.trust_score DESC NULLS LAST, RANDOM()
       LIMIT $1`,
      [limit, req.user.id]
    );

    res.json({ suggestions: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.discoverUsers = async (req, res, next) => {
  try {
    const { filter = 'all', city, skill, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.id, u.email,
             p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
             p.skills, p.trust_score, p.talent_tier,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as i_follow_them,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = $1) as they_follow_me,
             (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $1 AND u.is_active = true AND u.is_banned = false
    `;
    const params = [req.user.id];
    const conditions = [];

    if (filter === 'following') {
      conditions.push(`EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id)`);
    } else if (filter === 'followers') {
      conditions.push(`EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = $1)`);
    } else if (filter === 'mutual') {
      conditions.push(`EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id)`);
      conditions.push(`EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = $1)`);
    }

    if (city) {
      conditions.push(`p.city ILIKE $${params.length + 1}`);
      params.push(`%${city}%`);
    }

    if (skill) {
      conditions.push(`$${params.length + 1} = ANY(p.skills)`);
      params.push(skill);
    }

    if (search) {
      conditions.push(`(p.full_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    const countQuery = query.replace(/SELECT u\.id.*FROM/, 'SELECT COUNT(*) FROM');
    query += ` ORDER BY p.trust_score DESC NULLS LAST, p.full_name ASC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
        pages: Math.ceil(parseInt(count.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT 'doubt' as type, d.id, d.title, d.content, d.tags, d.subject, d.upvotes, d.status,
              d.created_at, d.author_id,
              p.full_name as author_name, p.avatar_url as author_avatar
       FROM doubts d
       JOIN users u ON d.author_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE d.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
         AND u.is_active = true

       UNION ALL

       SELECT 'answer' as type, da.id, d.title as question_title, da.content, NULL as tags, NULL as subject, da.upvotes, NULL as status,
              da.created_at, da.author_id,
              p.full_name as author_name, p.avatar_url as author_avatar
       FROM doubt_answers da
       JOIN doubts d ON da.doubt_id = d.id
       JOIN users u ON da.author_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE da.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
         AND u.is_active = true

       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM (
        SELECT d.id FROM doubts d
        WHERE d.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
        UNION ALL
        SELECT da.id FROM doubt_answers da
        WHERE da.author_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
      ) sub`,
      [req.user.id]
    );

    res.json({
      feed: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};
