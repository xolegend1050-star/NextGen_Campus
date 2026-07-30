const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getAllGigs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, category, skills, is_remote,
      min_compensation, max_compensation, status = 'open', sort = 'newest'
    } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT g.*,
             cp.company_name, cp.logo_url, cp.is_verified as company_verified,
             cp.trust_score as company_trust_score
      FROM gigs g
      JOIN users u ON g.company_id = u.id
      JOIN company_profiles cp ON u.id = cp.user_id
      WHERE g.status = $1 AND u.is_active = true
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM gigs g
      JOIN users u ON g.company_id = u.id
      WHERE g.status = $1 AND u.is_active = true
    `;
    const params = [status];
    const conditions = [];

    if (category) {
      conditions.push(`g.category = $${params.length + 1}`);
      params.push(category);
    }

    if (skills) {
      const skillArray = skills.split(',');
      conditions.push(`g.skills_required && $${params.length + 1}`);
      params.push(skillArray);
    }

    if (is_remote !== undefined) {
      conditions.push(`g.is_remote = $${params.length + 1}`);
      params.push(is_remote === 'true');
    }

    if (min_compensation) {
      conditions.push(`g.compensation >= $${params.length + 1}`);
      params.push(min_compensation);
    }

    if (max_compensation) {
      conditions.push(`g.compensation <= $${params.length + 1}`);
      params.push(max_compensation);
    }

    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query += ' ORDER BY g.created_at ASC';
        break;
      case 'highest_pay':
        query += ' ORDER BY g.compensation DESC';
        break;
      case 'most_applied':
        query += ' ORDER BY g.total_applications DESC';
        break;
      default:
        query += ' ORDER BY g.created_at DESC';
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [gigs, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      gigs: gigs.rows,
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

exports.getGigById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT g.*,
              cp.company_name, cp.logo_url, cp.website_url, cp.description as company_description,
              cp.is_verified as company_verified, cp.trust_score as company_trust_score,
              cp.total_gigs_posted, cp.average_rating
       FROM gigs g
       JOIN users u ON g.company_id = u.id
       JOIN company_profiles cp ON u.id = cp.user_id
       WHERE g.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    res.json({ gig: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createGig = async (req, res, next) => {
  try {
    const {
      title, description, requirements, skills_required, category, subcategory,
      compensation, duration_days, max_students, is_remote, location,
      application_deadline, start_date, end_date
    } = req.body;

    const result = await db.query(
      `INSERT INTO gigs (company_id, title, description, requirements, skills_required,
        category, subcategory, compensation, duration_days, max_students,
        is_remote, location, application_deadline, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'open')
       RETURNING *`,
      [
        req.user.id, title, description, requirements || null, skills_required,
        category, subcategory || null, compensation, duration_days, max_students || 1,
        is_remote !== false, location || null, application_deadline, start_date || null, end_date || null
      ]
    );

    // Update company's total gigs posted
    await db.query(
      'UPDATE company_profiles SET total_gigs_posted = total_gigs_posted + 1 WHERE user_id = $1',
      [req.user.id]
    );

    logger.info(`Gig created: ${result.rows[0].id} by company ${req.user.id}`);
    res.status(201).json({ gig: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateGig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const ALLOWED_GIG_FIELDS = ['title', 'description', 'requirements', 'skills_required', 'category', 'subcategory', 'compensation', 'duration_days', 'max_students', 'is_remote', 'location', 'application_deadline', 'start_date', 'end_date', 'status'];

    // Check ownership
    const existing = await db.query('SELECT company_id FROM gigs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    if (existing.rows[0].company_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && ALLOWED_GIG_FIELDS.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE gigs SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ gig: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteGig = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT company_id, status FROM gigs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    if (existing.rows[0].company_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (existing.rows[0].status === 'in_progress') {
      return res.status(400).json({ error: 'Cannot delete a gig in progress' });
    }

    await db.query('DELETE FROM gigs WHERE id = $1', [id]);
    res.json({ message: 'Gig deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.applyForGig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cover_letter, resume_url } = req.body;

    // Check if gig exists and is open
    const gig = await db.query(
      'SELECT id, status, application_deadline FROM gigs WHERE id = $1',
      [id]
    );

    if (gig.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.rows[0].status !== 'open') {
      return res.status(400).json({ error: 'Gig is not accepting applications' });
    }

    if (new Date(gig.rows[0].application_deadline) < new Date()) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }

    // Check for existing application
    const existingApplication = await db.query(
      'SELECT id FROM gig_applications WHERE gig_id = $1 AND student_id = $2',
      [id, req.user.id]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({ error: 'You have already applied for this gig' });
    }

    const result = await db.query(
      `INSERT INTO gig_applications (gig_id, student_id, cover_letter, resume_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.id, cover_letter || '', resume_url || null]
    );

    // Create notification for company
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'gig_shortlisted', 'New Application', 'You have a new application for your gig', $2)`,
      [gig.rows[0].company_id, JSON.stringify({ gig_id: id, application_id: result.rows[0].id })]
    );

    logger.info(`Gig application submitted: ${result.rows[0].id}`);
    res.status(201).json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getGigApplications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    // Check ownership
    const gig = await db.query('SELECT company_id FROM gigs WHERE id = $1', [id]);
    if (gig.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    if (gig.rows[0].company_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let query = `
      SELECT ga.*,
             p.full_name as student_name, p.avatar_url as student_avatar,
             p.skills, p.trust_score, p.talent_tier,
             p.city, p.college_name, p.course, p.year_of_study
      FROM gig_applications ga
      JOIN users u ON ga.student_id = u.id
      JOIN profiles p ON u.id = p.user_id
      WHERE ga.gig_id = $1
    `;
    const params = [id];

    if (status) {
      query += ` AND ga.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY ga.ai_match_score DESC NULLS LAST, ga.created_at DESC';

    const result = await db.query(query, params);
    res.json({ applications: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status, company_notes } = req.body;

    // Get application with gig info
    const application = await db.query(
      `SELECT ga.*, g.company_id
       FROM gig_applications ga
       JOIN gigs g ON ga.gig_id = g.id
       WHERE ga.id = $1`,
      [applicationId]
    );

    if (application.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.rows[0].company_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await db.query(
      `UPDATE gig_applications 
       SET status = $1, company_notes = $2, 
           shortlisted_at = CASE WHEN $1 = 'shortlisted' THEN NOW() ELSE shortlisted_at END,
           accepted_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE accepted_at END
       WHERE id = $3
       RETURNING *`,
      [status, company_notes || null, applicationId]
    );

    // Create notification for student
    let notificationType = 'gig_shortlisted';
    let notificationMessage = 'Your application has been shortlisted!';

    if (status === 'accepted') {
      notificationType = 'gig_accepted';
      notificationMessage = 'Congratulations! Your application has been accepted!';
    } else if (status === 'rejected') {
      notificationMessage = 'Your application has been declined.';
    }

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, 'Application Update', $3, $4)`,
      [application.rows[0].student_id, notificationType, notificationMessage,
       JSON.stringify({ application_id: applicationId, status })]
    );

    logger.info(`Application ${status}: ${applicationId}`);
    res.json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getMyApplications = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT ga.*,
             g.title as gig_title, g.compensation, g.duration_days,
             g.category, g.skills_required,
             cp.company_name, cp.logo_url
      FROM gig_applications ga
      JOIN gigs g ON ga.gig_id = g.id
      LEFT JOIN company_profiles cp ON g.company_id = cp.user_id
      WHERE ga.student_id = $1
    `;
    const params = [req.user.id];

    if (status) {
      query += ` AND ga.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY ga.created_at DESC';

    const result = await db.query(query, params);
    res.json({ applications: result.rows });
  } catch (error) {
    next(error);
  }
};
