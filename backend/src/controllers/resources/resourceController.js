const axios = require('axios');
const db = require('../../config/database');
const logger = require('../../utils/logger');

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
    let countQuery = 'SELECT COUNT(*) FROM resources WHERE is_approved = true';
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

    res.json({
      resources: resources.rows,
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
    if (resource_type && !VALID_TYPES.includes(resource_type)) {
      return res.status(400).json({ error: `Invalid resource type. Allowed: ${VALID_TYPES.join(', ')}` });
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

    // Award points
    await db.query(
      `INSERT INTO points_history (user_id, points, reason, reference_type, reference_id)
       VALUES ($1, 15, 'Completed interview practice', 'interview_practice', $2)`,
      [req.user.id, result.rows[0].id]
    );

    logger.info(`Interview practice completed: ${question_id}`);
    res.status(201).json({ practice: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
