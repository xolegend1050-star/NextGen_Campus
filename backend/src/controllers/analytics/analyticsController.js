const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.trackEvent = async (req, res, next) => {
  try {
    const { event_type, event_data, session_id } = req.body;

    await db.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, session_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, event_type, JSON.stringify(event_data || {}), session_id || null, req.ip, req.get('user-agent')]
    );

    res.status(201).json({ message: 'Event tracked' });
  } catch (error) {
    next(error);
  }
};

exports.getStudentAnalytics = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const [
      profile,
      doubtsCount,
      answersCount,
      sessionsCount,
      gigsApplied,
      gigsCompleted,
      totalEarned,
      badgesCount,
      recentActivity,
      skillAnalysis
    ] = await Promise.all([
      db.query(
        `SELECT trust_score, talent_tier, skills FROM profiles WHERE user_id = $1`,
        [studentId]
      ),
      db.query('SELECT COUNT(*) FROM doubts WHERE author_id = $1', [studentId]),
      db.query('SELECT COUNT(*) FROM doubt_answers WHERE author_id = $1', [studentId]),
      db.query(
        "SELECT COUNT(*) FROM mentorship_sessions WHERE student_id = $1 AND status = 'completed'",
        [studentId]
      ),
      db.query('SELECT COUNT(*) FROM gig_applications WHERE student_id = $1', [studentId]),
      db.query(
        "SELECT COUNT(*) FROM gig_applications WHERE student_id = $1 AND status = 'accepted'",
        [studentId]
      ),
      db.query(
        'SELECT total_earned FROM wallets WHERE user_id = $1',
        [studentId]
      ),
      db.query('SELECT COUNT(*) FROM user_badges WHERE user_id = $1', [studentId]),
      db.query(
        `SELECT activity_type, points_earned, created_at
         FROM student_activity_log
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [studentId]
      ),
      db.query(
        'SELECT skill, proficiency_level, confidence_score FROM student_skill_analysis WHERE student_id = $1',
        [studentId]
      )
    ]);

    res.json({
      analytics: {
        profile: profile.rows[0] || {},
        stats: {
          doubtsAsked: parseInt(doubtsCount.rows[0].count),
          answersGiven: parseInt(answersCount.rows[0].count),
          mentorshipSessions: parseInt(sessionsCount.rows[0].count),
          gigsApplied: parseInt(gigsApplied.rows[0].count),
          gigsCompleted: parseInt(gigsCompleted.rows[0].count),
          totalEarned: parseFloat(totalEarned.rows[0]?.total_earned || 0),
          badgesEarned: parseInt(badgesCount.rows[0].count)
        },
        recentActivity: recentActivity.rows,
        skillAnalysis: skillAnalysis.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { category = 'overall', period = 'all_time', limit = 20 } = req.query;

    let query;
    const params = [limit];

    switch (category) {
      case 'doubts':
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name,
                 COUNT(d.id) as score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN doubts d ON u.id = d.author_id
          WHERE u.is_active = true AND u.role = 'student'
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name
          ORDER BY score DESC
          LIMIT $1
        `;
        break;
      case 'mentorship':
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name,
                 COUNT(ms.id) as score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN mentorship_sessions ms ON u.id = ms.student_id AND ms.status = 'completed'
          WHERE u.is_active = true AND u.role = 'student'
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name
          ORDER BY score DESC
          LIMIT $1
        `;
        break;
      case 'gigs':
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name,
                 COUNT(ga.id) as score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN gig_applications ga ON u.id = ga.student_id AND ga.status = 'accepted'
          WHERE u.is_active = true AND u.role = 'student'
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name
          ORDER BY score DESC
          LIMIT $1
        `;
        break;
      default:
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name,
                 p.trust_score as score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          WHERE u.is_active = true AND u.role = 'student'
          ORDER BY p.trust_score DESC
          LIMIT $1
        `;
    }

    const result = await db.query(query, params);
    res.json({ leaderboard: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getPlatformAnalytics = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    let interval;
    switch (period) {
      case '24h': interval = '1 day'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      case '90d': interval = '90 days'; break;
      default: interval = '7 days';
    }

    const [
      newUsers,
      activeUsers,
      newDoubts,
      newAnswers,
      newApplications,
      newSessions,
      platformMetrics
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT COUNT(*) FROM doubts WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT COUNT(*) FROM doubt_answers WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT COUNT(*) FROM gig_applications WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT COUNT(*) FROM mentorship_sessions WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      db.query(
        `SELECT * FROM platform_metrics WHERE metric_date >= CURRENT_DATE - $1::interval
         ORDER BY metric_date DESC`, [interval]
      )
    ]);

    res.json({
      analytics: {
        period,
        users: {
          new: parseInt(newUsers.rows[0].count),
          active: parseInt(activeUsers.rows[0].count)
        },
        content: {
          newDoubts: parseInt(newDoubts.rows[0].count),
          newAnswers: parseInt(newAnswers.rows[0].count),
          newApplications: parseInt(newApplications.rows[0].count),
          newSessions: parseInt(newSessions.rows[0].count)
        },
        metrics: platformMetrics.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
