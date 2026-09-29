const axios = require('axios');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { awardPoints } = require('../../utils/trustTiers');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

exports.getResources = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, subject, difficulty, type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*,
             u.email as uploader_email,
             p.full_name as uploader_name
      FROM resources r
      JOIN users u ON r.uploader_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE r.is_approved = true
    `;
    // The count query needs the same table alias as the main one. Every filter
    // below is written as r.<column> so the same clause can be appended to both
    // statements, and appending r.<column> to a query whose table was unaliased
    // made Postgres raise
    //   missing FROM-clause entry for table "r"
    // so every use of the subject, difficulty or type filter returned a 500
    // while the unfiltered list worked fine.
    let countQuery = 'SELECT COUNT(*) FROM resources r WHERE r.is_approved = true';
    const params = [];
    const conditions = [];

    if (subject) {
      conditions.push(`r.subject = $${params.length + 1}`);
      params.push(subject);
    }

    if (difficulty) {
      conditions.push(`r.difficulty_level = $${params.length + 1}`);
      params.push(difficulty);
    }

    if (type) {
      conditions.push(`r.resource_type = $${params.length + 1}`);
      params.push(type);
    }

    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY r.download_count DESC, r.created_at DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [resources, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    // The subject and level filters need the whole vocabulary, not just the rows
    // on this page. Deriving the options from the paginated list meant only the
    // twelve resources of page one could ever be chosen, so a subject whose rows
    // all fell on page two could not be selected at all. Two DISTINCT queries
    // make the options independent of pagination.
    const [subjects, levels] = await Promise.all([
      db.query(
        "SELECT DISTINCT subject FROM resources WHERE is_approved = true AND subject IS NOT NULL AND subject <> '' ORDER BY subject"
      ),
      db.query(
        "SELECT DISTINCT difficulty_level FROM resources WHERE is_approved = true AND difficulty_level IS NOT NULL AND difficulty_level <> '' ORDER BY difficulty_level"
      )
    ]);

    res.json({
      resources: resources.rows,
      facets: {
        subjects: subjects.rows.map((r) => r.subject),
        levels: levels.rows.map((r) => r.difficulty_level)
      },
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

exports.uploadResource = async (req, res, next) => {
  try {
    const { title, description, resource_type, file_url, external_url, tags, subject, difficulty_level } = req.body;

    const VALID_TYPES = ['pdf', 'video', 'link', 'document', 'code'];

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    // resource_type is NOT NULL in the schema. Passing it through as undefined
    // produced "null value in column resource_type" and a 500 instead of a
    // validation error.
    if (!resource_type) {
      return res.status(400).json({ error: `resource_type is required. Allowed: ${VALID_TYPES.join(', ')}` });
    }
    if (!VALID_TYPES.includes(resource_type)) {
      return res.status(400).json({ error: `Invalid resource type. Allowed: ${VALID_TYPES.join(', ')}` });
    }
    if (!file_url && !external_url) {
      return res.status(400).json({ error: 'Provide either file_url or external_url' });
    }

    const result = await db.query(
      `INSERT INTO resources (uploader_id, title, description, resource_type, file_url, external_url, tags, subject, difficulty_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, title, description || null, resource_type, file_url || null, external_url || null, tags || [], subject || null, difficulty_level || null]
    );

    logger.info(`Resource uploaded: ${result.rows[0].id}`);
    res.status(201).json({ resource: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.recordDownload = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE resources SET download_count = download_count + 1 WHERE id = $1',
      [id]
    );

    res.json({ message: 'Download recorded' });
  } catch (error) {
    next(error);
  }
};

exports.getInterviewQuestions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, difficulty, company } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM interview_questions';
    let countQuery = 'SELECT COUNT(*) FROM interview_questions';
    const params = [];
    const conditions = [];

    if (category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category);
    }

    if (difficulty) {
      conditions.push(`difficulty_level = $${params.length + 1}`);
      params.push(difficulty);
    }

    if (company) {
      conditions.push(`company_name ILIKE $${params.length + 1}`);
      params.push(`%${company}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY asked_frequency DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [questions, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      questions: questions.rows,
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

exports.practiceInterview = async (req, res, next) => {
  try {
    const { question_id, student_answer } = req.body;

    // Check if question exists
    const question = await db.query(
      'SELECT * FROM interview_questions WHERE id = $1',
      [question_id]
    );

    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let aiFeedback = 'AI feedback pending...';
    let score = null;

    // Call AI service for feedback
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/mock-interview`, {
        role: question.rows[0].category || 'General',
        skills: [],
        question: question.rows[0].question_text,
        student_answer: student_answer
      });
      if (aiResponse.data.feedback) {
        aiFeedback = aiResponse.data.feedback;
        score = aiResponse.data.score || null;
      } else if (aiResponse.data.questions) {
        aiFeedback = aiResponse.data.questions;
      }
    } catch (aiError) {
      logger.warn('AI interview feedback failed (non-blocking):', aiError.message);
    }

    // Create a basic practice record
    const result = await db.query(
      `INSERT INTO interview_practice (student_id, question_id, student_answer, ai_feedback, score, time_taken_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, question_id, student_answer, aiFeedback, score, null]
    );

    // Increment asked frequency
    await db.query(
      'UPDATE interview_questions SET asked_frequency = asked_frequency + 1 WHERE id = $1',
      [question_id]
    );

    // Award points (also updates trust score)
    await awardPoints(req.user.id, 'interview_practice', 'interview_practice', result.rows[0].id);

    logger.info(`Interview practice completed: ${question_id}`);
    res.status(201).json({ practice: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
