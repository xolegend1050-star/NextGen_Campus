const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getMentors = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, skill, city, min_rating, available } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.id, u.email, 
             p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
             p.skills, p.trust_score, p.talent_tier,
             ap.graduation_year, ap.current_company, ap.current_designation,
             ap.years_of_experience, ap.mentoring_available, ap.mentorship_areas,
             (SELECT AVG(overall_rating) FROM ratings WHERE rated_id = u.id) as avg_rating,
             (SELECT COUNT(*) FROM mentorship_sessions WHERE mentor_id = u.id AND status = 'completed') as sessions_completed
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      JOIN alumni_profiles ap ON u.id = ap.user_id
      WHERE u.role = 'alumni' AND u.is_active = true AND u.is_banned = false
        AND ap.mentoring_available = true
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM users u
      JOIN alumni_profiles ap ON u.id = ap.user_id
      WHERE u.role = 'alumni' AND u.is_active = true AND u.is_banned = false
        AND ap.mentoring_available = true
    `;
    const params = [];
    const conditions = [];

    if (skill) {
      conditions.push(`$${params.length + 1} = ANY(p.skills)`);
      params.push(skill);
    }

    if (city) {
      conditions.push(`p.city ILIKE $${params.length + 1}`);
      params.push(`%${city}%`);
    }

    if (min_rating) {
      conditions.push(`(SELECT AVG(overall_rating) FROM ratings WHERE rated_id = u.id) >= $${params.length + 1}`);
      params.push(min_rating);
    }

    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY p.trust_score DESC, p.full_name ASC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [mentors, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      mentors: mentors.rows,
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

exports.getMentorshipRequests = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT mr.*,
             s.full_name as student_name, s.avatar_url as student_avatar,
             m.full_name as mentor_name, m.avatar_url as mentor_avatar
      FROM mentorship_requests mr
      JOIN users su ON mr.student_id = su.id
      JOIN profiles s ON su.id = s.user_id
      JOIN users mu ON mr.mentor_id = mu.id
      JOIN profiles m ON mu.id = m.user_id
      WHERE (mr.student_id = $1 OR mr.mentor_id = $1)
    `;
    const params = [req.user.id];

    if (status) {
      query += ` AND mr.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY mr.created_at DESC';

    const result = await db.query(query, params);
    res.json({ requests: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.requestMentorship = async (req, res, next) => {
  try {
    const { mentor_id, message, student_goals, preferred_session_type } = req.body;

    // Check if mentor exists and is available
    const mentor = await db.query(
      `SELECT u.id, ap.mentoring_available, ap.max_mentees
       FROM users u
       JOIN alumni_profiles ap ON u.id = ap.user_id
       WHERE u.id = $1 AND u.role = 'alumni' AND u.is_active = true`,
      [mentor_id]
    );

    if (mentor.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found or unavailable' });
    }

    if (!mentor.rows[0].mentoring_available) {
      return res.status(400).json({ error: 'Mentor is not currently accepting mentees' });
    }

    // Check active mentee count
    const activeMentees = await db.query(
      `SELECT COUNT(*) FROM mentorship_requests 
       WHERE mentor_id = $1 AND status IN ('pending', 'accepted')`,
      [mentor_id]
    );

    if (parseInt(activeMentees.rows[0].count) >= mentor.rows[0].max_mentees) {
      return res.status(400).json({ error: 'Mentor has reached maximum mentee capacity' });
    }

    // Check for existing request
    const existingRequest = await db.query(
      `SELECT id FROM mentorship_requests 
       WHERE student_id = $1 AND mentor_id = $2 AND status IN ('pending', 'accepted')`,
      [req.user.id, mentor_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active request with this mentor' });
    }

    // Create request
    const result = await db.query(
      `INSERT INTO mentorship_requests (student_id, mentor_id, message, student_goals, preferred_session_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, mentor_id, message || '', student_goals || '', preferred_session_type || 'chat']
    );

    // Create notification for mentor
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'mentor_request', 'New Mentorship Request', $2, $3)`,
      [mentor_id, `You have a new mentorship request`, JSON.stringify({ request_id: result.rows[0].id })]
    );

    logger.info(`Mentorship request created: ${result.rows[0].id}`);
    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateRequestStatus = async (req, res, next) => {
  try {
    const requestId = req.params.requestId || req.params.id;
    const status = req.body.status || req.params.action;

    // Get request
    const request = await db.query(
      'SELECT * FROM mentorship_requests WHERE id = $1',
      [requestId]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user is the mentor
    if (request.rows[0].mentor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update status
    const result = await db.query(
      `UPDATE mentorship_requests 
       SET status = $1, responded_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, requestId]
    );

    // Create notification for student
    const notificationMessage = status === 'accepted' 
      ? 'Your mentorship request has been accepted!'
      : 'Your mentorship request has been declined.';

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'mentor_request', 'Mentorship Request Update', $2, $3)`,
      [request.rows[0].student_id, notificationMessage, JSON.stringify({ request_id: requestId, status })]
    );

    logger.info(`Mentorship request ${status}: ${requestId}`);
    res.json({ request: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getSessions = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ms.*,
              s.full_name as student_name, s.avatar_url as student_avatar,
              m.full_name as mentor_name, m.avatar_url as mentor_avatar
       FROM mentorship_sessions ms
       JOIN users su ON ms.student_id = su.id
       JOIN profiles s ON su.id = s.user_id
       JOIN users mu ON ms.mentor_id = mu.id
       JOIN profiles m ON mu.id = m.user_id
       WHERE ms.student_id = $1 OR ms.mentor_id = $1
       ORDER BY ms.scheduled_at DESC`,
      [req.user.id]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.rateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const {
      overall_rating,
      communication_rating,
      knowledge_rating,
      punctuality_rating,
      helpfulness_rating,
      review
    } = req.body;

    // Get session
    const session = await db.query(
      'SELECT * FROM mentorship_sessions WHERE id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is the student
    if (session.rows[0].student_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the student can rate the session' });
    }

    // Check for existing rating
    const existingRating = await db.query(
      'SELECT id FROM ratings WHERE rater_id = $1 AND session_id = $2',
      [req.user.id, sessionId]
    );

    if (existingRating.rows.length > 0) {
      return res.status(400).json({ error: 'You have already rated this session' });
    }

    // Create rating
    const result = await db.query(
      `INSERT INTO ratings (rater_id, rated_id, session_id, overall_rating, 
        communication_rating, knowledge_rating, punctuality_rating, helpfulness_rating, review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id,
        session.rows[0].mentor_id,
        sessionId,
        overall_rating,
        communication_rating || null,
        knowledge_rating || null,
        punctuality_rating || null,
        helpfulness_rating || null,
        review || null
      ]
    );

    // Update mentor's average rating
    const avgRating = await db.query(
      'SELECT AVG(overall_rating) as avg FROM ratings WHERE rated_id = $1',
      [session.rows[0].mentor_id]
    );

    // Update trust score based on rating
    const trustScoreChange = (overall_rating - 3) * 2; // -4 to +4 points
    await db.query(
      `UPDATE profiles SET trust_score = GREATEST(0, trust_score + $1) WHERE user_id = $2`,
      [trustScoreChange, session.rows[0].mentor_id]
    );

    // Create notification for mentor
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'session_completed', 'Session Rated', 'Your session has been rated', $2)`,
      [session.rows[0].mentor_id, JSON.stringify({ session_id: sessionId, rating: overall_rating })]
    );

    logger.info(`Session rated: ${sessionId} with ${overall_rating} stars`);
    res.json({ rating: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
