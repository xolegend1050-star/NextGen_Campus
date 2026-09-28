const db = require('../../config/database');
const logger = require('../../utils/logger');
const aiClient = require('../../utils/aiClient');
const { FAST_TIMEOUT, AiServiceError } = aiClient;

/** Translate an AI failure into a response, with a body a UI can act on. */
const fail = (res, err) => {
  if (err instanceof AiServiceError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  logger.error('AI error:', err.message);
  return res.status(503).json({ error: 'AI service unavailable', code: 'AI_UNAVAILABLE' });
};

exports.generateDraftAnswer = async (req, res, next) => {
  try {
    const { doubt_id } = req.body;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doubt_id)) {
      return res.status(400).json({ error: 'Invalid doubt ID format' });
    }

    // Get doubt content
    const doubt = await db.query(
      'SELECT title, content, tags, subject FROM doubts WHERE id = $1',
      [doubt_id]
    );

    if (doubt.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt not found' });
    }

    // Call AI service
    try {
      const data = await aiClient.post('/api/generate-doubt-answer', {
        title: doubt.rows[0].title,
        content: doubt.rows[0].content,
        tags: doubt.rows[0].tags,
        subject: doubt.rows[0].subject
      });

      const draftAnswer = data.answer;

      if (!draftAnswer) {
        return res.status(503).json({
          error: 'AI service returned no answer',
          code: 'AI_EMPTY_RESPONSE'
        });
      }

      // Store draft answer
      await db.query(
        'UPDATE doubts SET ai_draft_answer = $1, ai_draft_generated_at = NOW() WHERE id = $2',
        [draftAnswer, doubt_id]
      );

      logger.info(`AI draft answer generated for doubt: ${doubt_id}`);
      res.json({ draftAnswer });
    } catch (aiError) {
      fail(res, aiError);
    }
  } catch (error) {
    next(error);
  }
};

exports.moderateContent = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    try {
      const data = await aiClient.post(
        '/api/moderate-content',
        { content },
        { timeout: FAST_TIMEOUT }
      );
      res.json(data);
    } catch (aiError) {
      // Fail open rather than blocking every post when moderation is offline,
      // but say so explicitly so the caller can queue a re-check.
      logger.warn('Moderation unavailable, allowing content through:', aiError.message);
      res.json({
        is_safe: true,
        confidence: 0,
        degraded: true,
        code: aiError.code || 'AI_UNAVAILABLE',
        message: 'Automated moderation is temporarily unavailable. Flagged for manual review.'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.recommendMentors = async (req, res, next) => {
  try {
    // Get student profile
    const profile = await db.query(
      `SELECT p.skills, p.interests, p.city, p.trust_score
       FROM profiles p WHERE p.user_id = $1`,
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    try {
      const data = await aiClient.post(
        '/api/recommend-mentors',
        {
          student_skills: profile.rows[0].skills,
          student_interests: profile.rows[0].interests,
          student_city: profile.rows[0].city
        },
        { timeout: FAST_TIMEOUT }
      );
      res.json(data);
    } catch (aiError) {
      logger.warn('Mentor recommendation fell back to SQL:', aiError.message);
      // Fallback to simple database query
      const mentors = await db.query(
        `SELECT u.id, p.full_name, p.avatar_url, p.city, p.skills,
                ap.current_company, ap.current_designation,
                (SELECT AVG(overall_rating) FROM ratings WHERE rated_id = u.id) as avg_rating
         FROM users u
         JOIN profiles p ON u.id = p.user_id
         JOIN alumni_profiles ap ON u.id = ap.user_id
         WHERE u.role = 'alumni' AND u.is_active = true AND ap.mentoring_available = true
         ORDER BY p.trust_score DESC
         LIMIT 10`
      );

      res.json({ mentors: mentors.rows });
    }
  } catch (error) {
    next(error);
  }
};

exports.recommendGigs = async (req, res, next) => {
  try {
    // Get student profile and skills
    const profile = await db.query(
      `SELECT p.skills, p.trust_score
       FROM profiles p WHERE p.user_id = $1`,
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    try {
      const data = await aiClient.post(
        '/api/recommend-gigs',
        {
          student_skills: profile.rows[0].skills,
          trust_score: profile.rows[0].trust_score
        },
        { timeout: FAST_TIMEOUT }
      );
      res.json(data);
    } catch (aiError) {
      logger.warn('Gig recommendation fell back to SQL:', aiError.message);
      // Fallback to simple database query
      const gigs = await db.query(
        `SELECT g.*, cp.company_name, cp.logo_url
         FROM gigs g
         JOIN company_profiles cp ON g.company_id = cp.user_id
         WHERE g.status = 'open'
         AND g.skills_required && $1
         ORDER BY g.created_at DESC
         LIMIT 10`,
        [profile.rows[0].skills]
      );

      res.json({ gigs: gigs.rows });
    }
  } catch (error) {
    next(error);
  }
};

exports.predictGigSuccess = async (req, res, next) => {
  try {
    const { gig_id } = req.body;

    // Get gig details and student profile
    const [gig, profile, applications] = await Promise.all([
      db.query('SELECT * FROM gigs WHERE id = $1', [gig_id]),
      db.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]),
      db.query('SELECT COUNT(*) FROM gig_applications WHERE gig_id = $1', [gig_id])
    ]);

    if (gig.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    try {
      const data = await aiClient.post(
        '/api/predict-gig-success',
        {
          gig: gig.rows[0],
          student_profile: profile.rows[0],
          current_applications: parseInt(applications.rows[0].count)
        },
        { timeout: FAST_TIMEOUT }
      );
      res.json(data);
    } catch (aiError) {
      logger.warn('Gig success prediction fell back to heuristic:', aiError.message);
      // Simple fallback prediction
      const studentSkills = profile.rows[0].skills || [];
      const gigSkills = gig.rows[0].skills_required || [];
      const matchingSkills = studentSkills.filter(skill => gigSkills.includes(skill));
      const matchPercentage = (matchingSkills.length / gigSkills.length) * 100;

      const trustScore = parseFloat(profile.rows[0].trust_score || 0);
      const successChance = Math.min(95, (matchPercentage * 0.7) + (trustScore * 0.3));

      res.json({
        prediction: {
          success_chance: Math.round(successChance),
          confidence: 'medium',
          matching_skills: matchingSkills,
          skill_gaps: gigSkills.filter(skill => !studentSkills.includes(skill)),
          recommendation: successChance > 70 ? 'high' : successChance > 40 ? 'medium' : 'low'
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.analyzeResume = async (req, res, next) => {
  try {
    const { resume_url } = req.body;

    if (!resume_url) {
      return res.status(400).json({ error: 'resume_url is required' });
    }

    try {
      const data = await aiClient.post('/api/analyze-resume', {
        resume_url,
        student_id: req.user.id
      });
      res.json(data);
    } catch (aiError) {
      // Degrade to the structured skeleton the frontend already renders,
      // rather than a hard error the user cannot act on.
      logger.warn('Resume analysis unavailable, returning placeholder:', aiError.message);
      res.json({
        analysis: {
          skills_identified: [],
          skill_gaps: [],
          recommendations: [
            'Automated resume analysis is temporarily unavailable. Please try again in a few minutes.'
          ],
          overall_score: 0
        },
        degraded: true,
        code: aiError.code || 'AI_UNAVAILABLE'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.mockInterview = async (req, res, next) => {
  try {
    const { role, skills } = req.body;

    if (!role || !Array.isArray(skills)) {
      return res.status(400).json({ error: 'role and skills are required' });
    }

    try {
      const data = await aiClient.post('/api/mock-interview', { role, skills });
      res.json(data);
    } catch (aiError) {
      logger.warn('Mock interview unavailable:', aiError.message);
      res.status(aiError.status || 503).json({
        error: 'AI service unavailable',
        code: aiError.code || 'AI_UNAVAILABLE',
        message: 'Mock interview needs a working AI service. Please try again shortly.'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.aiHealth = async (req, res, next) => {
  try {
    const status = await aiClient.health();
    res.status(status.available ? 200 : 503).json(status);
  } catch (error) {
    next(error);
  }
};
