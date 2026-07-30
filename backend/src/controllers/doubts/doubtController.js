const axios = require('axios');
const db = require('../../config/database');
const logger = require('../../utils/logger');

const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
};

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

exports.getAllDoubts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, subject, sort = 'newest', search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, 
             u.email as author_email,
             p.full_name as author_name,
             p.avatar_url as author_avatar,
             p.trust_score as author_trust_score,
             (SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = d.id) as answer_count
      FROM doubts d
      JOIN users u ON d.author_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
    `;
    let countQuery = 'SELECT COUNT(*) FROM doubts d';
    const params = [];
    const conditions = [];
    const joins = [];

    if (status) {
      conditions.push(`d.status = $${params.length + 1}`);
      params.push(status);
    }

    if (subject) {
      conditions.push(`d.subject = $${params.length + 1}`);
      params.push(subject);
    }

    if (search) {
      conditions.push(`(d.title ILIKE $${params.length + 1} OR d.content ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query += ' ORDER BY d.created_at ASC';
        break;
      case 'popular':
        query += ' ORDER BY d.upvotes DESC, d.created_at DESC';
        break;
      case 'unanswered':
        query += ' ORDER BY (SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = d.id) ASC, d.created_at DESC';
        break;
      default:
        query += ' ORDER BY d.created_at DESC';
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [doubts, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      doubts: doubts.rows,
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

exports.getDoubtById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Increment views
    await db.query('UPDATE doubts SET views = views + 1 WHERE id = $1', [id]);

    const result = await db.query(
      `SELECT d.*, 
              u.email as author_email,
              p.full_name as author_name,
              p.avatar_url as author_avatar,
              p.trust_score as author_trust_score
       FROM doubts d
       JOIN users u ON d.author_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }

    res.json({ doubt: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createDoubt = async (req, res, next) => {
  try {
    const { title, content, tags, subject, topic } = req.body;

    const cleanTitle = sanitizeInput(title);
    const cleanContent = sanitizeInput(content);

    const result = await db.query(
      `INSERT INTO doubts (author_id, title, content, tags, subject, topic)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, cleanTitle, cleanContent, tags, subject || null, topic || null]
    );

    // Call AI service to generate draft answer
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/generate-doubt-answer`, {
        title,
        content,
        tags: tags || [],
        subject: subject || ''
      });
      if (aiResponse.data.answer) {
        await db.query(
          'UPDATE doubts SET ai_draft_answer = $1, ai_draft_generated_at = NOW() WHERE id = $2',
          [aiResponse.data.answer, result.rows[0].id]
        );
        result.rows[0].ai_draft_answer = aiResponse.data.answer;
      }
    } catch (aiError) {
      logger.warn('AI draft generation failed (non-blocking):', aiError.message);
    }

    logger.info(`Doubt created: ${result.rows[0].id} by user ${req.user.id}`);

    res.status(201).json({ doubt: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateDoubt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, tags, subject, topic } = req.body;

    // Check ownership
    const existing = await db.query('SELECT author_id FROM doubts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }
    if (existing.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) { updates.push(`title = $${paramCount}`); values.push(sanitizeInput(title)); paramCount++; }
    if (content) { updates.push(`content = $${paramCount}`); values.push(sanitizeInput(content)); paramCount++; }
    if (tags) { updates.push(`tags = $${paramCount}`); values.push(tags); paramCount++; }
    if (subject) { updates.push(`subject = $${paramCount}`); values.push(subject); paramCount++; }
    if (topic) { updates.push(`topic = $${paramCount}`); values.push(topic); paramCount++; }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE doubts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ doubt: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteDoubt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT author_id FROM doubts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }
    if (existing.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query('DELETE FROM doubts WHERE id = $1', [id]);
    res.json({ message: 'Doubt deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.answerDoubt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Check if doubt exists
    const doubt = await db.query('SELECT id, status FROM doubts WHERE id = $1', [id]);
    if (doubt.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }

    const result = await db.query(
      `INSERT INTO doubt_answers (doubt_id, author_id, content, source)
       VALUES ($1, $2, $3, 'peer')
       RETURNING *`,
      [id, req.user.id, content]
    );

    // Update doubt status to answered
    if (doubt.rows[0].status === 'open') {
      await db.query("UPDATE doubts SET status = 'answered' WHERE id = $1", [id]);
    }

    // Award points to answerer
    await db.query(
      `INSERT INTO points_history (user_id, points, reason, reference_type, reference_id)
       VALUES ($1, 10, 'Answered a doubt', 'doubt_answer', $2)`,
      [req.user.id, result.rows[0].id]
    );

    logger.info(`Doubt answered: ${id} by user ${req.user.id}`);

    res.status(201).json({ answer: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getDoubtAnswers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT da.*,
              u.email as author_email,
              p.full_name as author_name,
              p.avatar_url as author_avatar,
              p.trust_score as author_trust_score
       FROM doubt_answers da
       JOIN users u ON da.author_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE da.doubt_id = $1
       ORDER BY da.is_accepted DESC, da.upvotes DESC, da.created_at ASC`,
      [id]
    );

    res.json({ answers: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.voteDoubt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body;

    // Check if already voted
    const existingVote = await db.query(
      'SELECT id, vote_type FROM doubt_votes WHERE user_id = $1 AND doubt_id = $2',
      [req.user.id, id]
    );

    if (existingVote.rows.length > 0) {
      // Update vote
      if (existingVote.rows[0].vote_type === vote_type) {
        // Remove vote
        await db.query('DELETE FROM doubt_votes WHERE id = $1', [existingVote.rows[0].id]);
        return res.json({ message: 'Vote removed' });
      } else {
        await db.query('UPDATE doubt_votes SET vote_type = $1 WHERE id = $2', [vote_type, existingVote.rows[0].id]);
        return res.json({ message: 'Vote updated' });
      }
    }

    await db.query(
      'INSERT INTO doubt_votes (user_id, doubt_id, vote_type) VALUES ($1, $2, $3)',
      [req.user.id, id, vote_type]
    );

    res.json({ message: 'Vote recorded' });
  } catch (error) {
    next(error);
  }
};

exports.voteAnswer = async (req, res, next) => {
  try {
    const { answerId } = req.params;
    const { vote_type } = req.body;

    // Check if already voted
    const existingVote = await db.query(
      'SELECT id, vote_type FROM doubt_votes WHERE user_id = $1 AND answer_id = $2',
      [req.user.id, answerId]
    );

    if (existingVote.rows.length > 0) {
      if (existingVote.rows[0].vote_type === vote_type) {
        await db.query('DELETE FROM doubt_votes WHERE id = $1', [existingVote.rows[0].id]);
        return res.json({ message: 'Vote removed' });
      } else {
        await db.query('UPDATE doubt_votes SET vote_type = $1 WHERE id = $2', [vote_type, existingVote.rows[0].id]);
        return res.json({ message: 'Vote updated' });
      }
    }

    await db.query(
      'INSERT INTO doubt_votes (user_id, answer_id, vote_type) VALUES ($1, $2, $3)',
      [req.user.id, answerId, vote_type]
    );

    res.json({ message: 'Vote recorded' });
  } catch (error) {
    next(error);
  }
};

exports.acceptAnswer = async (req, res, next) => {
  try {
    const { id, answerId } = req.params;

    // Check if user is the doubt author
    const doubt = await db.query('SELECT author_id FROM doubts WHERE id = $1', [id]);
    if (doubt.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }
    if (doubt.rows[0].author_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the doubt author can accept answers' });
    }

    // Check if answer belongs to this doubt
    const answer = await db.query('SELECT id FROM doubt_answers WHERE id = $1 AND doubt_id = $2', [answerId, id]);
    if (answer.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    // Unaccept any previously accepted answers
    await db.query('UPDATE doubt_answers SET is_accepted = false WHERE doubt_id = $1', [id]);

    // Accept this answer
    await db.query('UPDATE doubt_answers SET is_accepted = true WHERE id = $1', [answerId]);

    // Update doubt status
    await db.query("UPDATE doubts SET status = 'closed', accepted_answer_id = $1 WHERE id = $2", [answerId, id]);

    // Award points to answer author
    const answerAuthor = await db.query('SELECT author_id FROM doubt_answers WHERE id = $1', [answerId]);
    await db.query(
      `INSERT INTO points_history (user_id, points, reason, reference_type, reference_id)
       VALUES ($1, 25, 'Answer accepted', 'doubt_accepted', $2)`,
      [answerAuthor.rows[0].author_id, answerId]
    );

    res.json({ message: 'Answer accepted' });
  } catch (error) {
    next(error);
  }
};
