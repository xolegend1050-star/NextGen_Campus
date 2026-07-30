const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getAllBadges = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM badges WHERE is_active = true ORDER BY category, tier, points_value'
    );

    res.json({ badges: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getMyBadges = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*, ub.earned_at
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

exports.getMyPoints = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT SUM(points) as total_points
       FROM points_history
       WHERE user_id = $1`,
      [req.user.id]
    );

    const recentPoints = await db.query(
      `SELECT * FROM points_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      totalPoints: parseInt(result.rows[0].total_points || 0),
      recentActivity: recentPoints.rows
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check and award badges
exports.checkAndAwardBadges = async (userId) => {
  const userStats = await db.query(
    `SELECT 
       (SELECT COUNT(*) FROM doubts WHERE author_id = $1) as doubts_asked,
       (SELECT COUNT(*) FROM doubt_answers WHERE author_id = $1) as answers_given,
       (SELECT COUNT(*) FROM doubt_answers WHERE author_id = $1 AND is_accepted = true) as answers_accepted,
       (SELECT COUNT(*) FROM mentorship_sessions WHERE student_id = $1 AND status = 'completed') as sessions_completed,
       (SELECT COUNT(*) FROM gig_applications WHERE student_id = $1 AND status = 'accepted') as gigs_completed,
       (SELECT total_earned FROM wallets WHERE user_id = $1) as total_earned`,
    [userId]
  );

  const stats = userStats.rows[0];
  const badgesToAward = [];

  // First Steps badge
  if (stats.doubts_asked === 0 && stats.answers_given === 0) {
    badgesToAward.push('First Steps');
  }

  // Curious Mind badge
  if (parseInt(stats.doubts_asked) >= 1) {
    badgesToAward.push('Curious Mind');
  }

  // Problem Solver badge
  if (parseInt(stats.answers_accepted) >= 5) {
    badgesToAward.push('Problem Solver');
  }

  // Knowledge Guru badge
  if (parseInt(stats.answers_accepted) >= 25) {
    badgesToAward.push('Knowledge Guru');
  }

  // Helpful Hand badge
  if (parseInt(stats.answers_given) >= 10) {
    badgesToAward.push('Helpful Hand');
  }

  // First Mentorship badge
  if (parseInt(stats.sessions_completed) >= 1) {
    badgesToAward.push('First Mentorship');
  }

  // Mentor Master badge
  if (parseInt(stats.sessions_completed) >= 10) {
    badgesToAward.push('Mentor Master');
  }

  // First Gig badge
  if (parseInt(stats.gigs_completed) >= 1) {
    badgesToAward.push('First Gig');
  }

  // Gig Champion badge
  if (parseInt(stats.gigs_completed) >= 10) {
    badgesToAward.push('Gig Champion');
  }

  // Top Earner badge
  if (parseFloat(stats.total_earned || 0) >= 10000) {
    badgesToAward.push('Top Earner');
  }

  // Award badges
  for (const badgeName of badgesToAward) {
    const badge = await db.query('SELECT id FROM badges WHERE name = $1', [badgeName]);
    if (badge.rows.length > 0) {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, badge.rows[0].id]
      );
    }
  }

  return badgesToAward;
};
