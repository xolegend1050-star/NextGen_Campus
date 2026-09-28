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

    // period was accepted but never applied, so every request returned
    // all-time numbers regardless of what the client asked for
    const since = period === 'weekly'
      ? "NOW() - INTERVAL '7 days'"
      : period === 'monthly'
        ? "NOW() - INTERVAL '30 days'"
        : null;

    const params = [limit];
    let query;
    switch (category) {
      case 'doubts': {
        params.push(since || null);
        const s = params.length;
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email,
                 COUNT(d.id)::int AS score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN doubts d ON u.id = d.author_id
          WHERE u.is_active = true AND u.role = 'student'
            AND ($${s}::timestamptz IS NULL OR d.created_at >= $${s}::timestamptz)
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email
          ORDER BY score DESC, p.full_name ASC
          LIMIT $1
        `;
        break;
      }
      case 'mentorship': {
        params.push(since || null);
        const s = params.length;
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email,
                 COUNT(ms.id)::int AS score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN mentorship_sessions ms
            ON u.id = ms.student_id AND ms.status = 'completed'
          WHERE u.is_active = true AND u.role = 'student'
            AND ($${s}::timestamptz IS NULL OR ms.created_at >= $${s}::timestamptz)
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email
          ORDER BY score DESC, p.full_name ASC
          LIMIT $1
        `;
        break;
      }
      case 'gigs': {
        params.push(since || null);
        const s = params.length;
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email,
                 COUNT(ga.id)::int AS score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          LEFT JOIN gig_applications ga
            ON u.id = ga.student_id AND ga.status = 'accepted'
          WHERE u.is_active = true AND u.role = 'student'
            AND ($${s}::timestamptz IS NULL OR ga.created_at >= $${s}::timestamptz)
          GROUP BY u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email
          ORDER BY score DESC, p.full_name ASC
          LIMIT $1
        `;
        break;
      }
      default:
        query = `
          SELECT u.id, p.full_name, p.avatar_url, p.city, p.college_name, u.email,
                 COALESCE(p.trust_score, 0)::int AS score
          FROM users u
          JOIN profiles p ON u.id = p.user_id
          WHERE u.is_active = true AND u.role = 'student'
          ORDER BY score DESC, p.full_name ASC
          LIMIT $1
        `;
    }

    const result = await db.query(query, params);
    res.json({ leaderboard: result.rows, category, period });
  } catch (error) {
    next(error);
  }
};

const PERIOD_INTERVALS = {
  '24h': '1 day',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days'
};

const PERIOD_BUCKETS = {
  '24h': 24,
  '7d': 7,
  '30d': 30,
  '90d': 13
};

exports.getPlatformAnalytics = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;
    const interval = PERIOD_INTERVALS[period] || '7 days';
    const buckets = PERIOD_BUCKETS[period] || 7;

    const [
      newUsers,
      activeUsers,
      newDoubts,
      newAnswers,
      newApplications,
      newSessions,
      totals,
      trends,
      escrow
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - $1::interval`, [interval]
      ),
      // last_seen_at is written on every socket connect, unlike analytics_events
      // which no client populates, so "active" used to always be zero
      db.query(
        `SELECT COUNT(DISTINCT id)::int AS count FROM users
          WHERE last_seen_at IS NOT NULL AND last_seen_at >= NOW() - $1::interval`,
        [interval]
      ),
      db.query(`SELECT COUNT(*)::int AS count FROM doubts WHERE created_at >= NOW() - $1::interval`, [interval]),
      db.query(`SELECT COUNT(*)::int AS count FROM doubt_answers WHERE created_at >= NOW() - $1::interval`, [interval]),
      db.query(`SELECT COUNT(*)::int AS count FROM gig_applications WHERE created_at >= NOW() - $1::interval`, [interval]),
      db.query(`SELECT COUNT(*)::int AS count FROM mentorship_sessions WHERE created_at >= NOW() - $1::interval`, [interval]),
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active)::int AS students,
          (SELECT COUNT(*) FROM users WHERE role = 'alumni' AND is_active)::int AS alumni,
          (SELECT COUNT(*) FROM users WHERE role = 'company' AND is_active)::int AS companies,
          (SELECT COUNT(*) FROM doubts)::int AS doubts,
          (SELECT COUNT(*) FROM gigs WHERE status = 'open')::int AS open_gigs,
          (SELECT COUNT(*) FROM gig_applications)::int AS applications,
          (SELECT COALESCE(SUM(amount), 0) FROM escrow_transactions WHERE status = 'released')::numeric(12,2) AS paid_out
      `),
      // Trends are derived from the live tables so they are populated from day
      // one. The platform_metrics rollup table is still read when present.
      // Only $1 is bound: passing the interval as an unused second parameter
      // made Postgres reject the query with "could not determine data type of
      // parameter $1".
      db.query(`
        SELECT bucket::date AS day,
               COALESCE(d.doubts, 0)::int     AS doubts,
               COALESCE(a.answers, 0)::int    AS answers,
               COALESCE(us.users, 0)::int     AS new_users,
               COALESCE(ap.apps, 0)::int      AS applications
          FROM generate_series(
                 date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
                 date_trunc('day', NOW()),
                 INTERVAL '1 day'
               ) AS bucket
          LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS doubts
              FROM doubts GROUP BY 1
          ) d ON d.day = bucket::date
          LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS answers
              FROM doubt_answers GROUP BY 1
          ) a ON a.day = bucket::date
          LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS users
              FROM users WHERE role = 'student' GROUP BY 1
          ) us ON us.day = bucket::date
          LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS apps
              FROM gig_applications GROUP BY 1
          ) ap ON ap.day = bucket::date
         ORDER BY bucket
      `, [buckets]),
      // Always emit a row per known status so the dashboard can render a
      // complete picture instead of an empty chart on a fresh database
      db.query(`
        SELECT s.status,
               COUNT(e.id)::int AS count,
               COALESCE(SUM(e.amount), 0)::numeric(12,2) AS amount
          FROM (VALUES ('locked'),('released'),('refunded'),('disputed')) AS s(status)
          LEFT JOIN escrow_transactions e ON e.status = s.status
         GROUP BY s.status
         ORDER BY s.status
      `)
    ]);

    res.json({
      analytics: {
        period,
        interval,
        users: {
          new: newUsers.rows[0].count,
          active: activeUsers.rows[0].count,
          ...totals.rows[0]
        },
        content: {
          newDoubts: newDoubts.rows[0].count,
          newAnswers: newAnswers.rows[0].count,
          newApplications: newApplications.rows[0].count,
          newSessions: newSessions.rows[0].count
        },
        totals: totals.rows[0],
        escrow: escrow.rows,
        trends: trends.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
