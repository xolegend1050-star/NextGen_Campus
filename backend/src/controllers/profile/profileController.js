const db = require('../../config/database');
const logger = require('../../utils/logger');

// ==================== PROFILE ====================

exports.getMyProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.email, u.role, u.is_email_verified
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const {
      full_name, bio, phone, city, state, college_name, college_city,
      course, year_of_study, graduation_date, graduation_year,
      skills, interests, linkedin_url, github_url, portfolio_url,
      cover_url, visibility_settings
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    const fields = {
      full_name, bio, phone, city, state, college_name, college_city,
      course, year_of_study, graduation_date, graduation_year,
      linkedin_url, github_url, portfolio_url, cover_url
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (skills !== undefined) {
      updates.push(`skills = $${paramCount}`);
      values.push(skills);
      paramCount++;
    }

    if (interests !== undefined) {
      updates.push(`interests = $${paramCount}`);
      values.push(interests);
      paramCount++;
    }

    if (visibility_settings !== undefined) {
      updates.push(`visibility_settings = $${paramCount}`);
      values.push(visibility_settings);
      paramCount++;
    }

    updates.push('updated_at = NOW()');

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(req.user.id);
    let result = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      // Profile doesn't exist yet, create it then update
      const nameVal = full_name || 'New User';
      await db.query(
        'INSERT INTO profiles (user_id, full_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [req.user.id, nameVal]
      );
      result = await db.query(
        `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${paramCount}
         RETURNING *`,
        values
      );
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getPublicProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const [profileRes, experienceRes, projectsRes] = await Promise.all([
      db.query(
        `SELECT p.full_name, p.avatar_url, p.cover_url, p.bio, p.city, p.state,
                p.college_name, p.course, p.year_of_study, p.graduation_year,
                p.skills, p.interests, p.trust_score, p.talent_tier,
                p.linkedin_url, p.github_url, p.portfolio_url,
                p.is_profile_complete, u.role, u.created_at
         FROM profiles p
         JOIN users u ON p.user_id = u.id
         WHERE p.user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT pe.id, pe.title, pe.company_name, pe.description,
                pe.start_date, pe.end_date, pe.is_current
         FROM profile_experience pe
         JOIN profiles p ON pe.profile_id = p.id
         WHERE p.user_id = $1
         ORDER BY pe.is_current DESC, pe.start_date DESC`,
        [userId]
      ),
      db.query(
        `SELECT pp.id, pp.title, pp.description, pp.project_url,
                pp.github_url, pp.technologies, pp.image_url
         FROM profile_projects pp
         JOIN profiles p ON pp.profile_id = p.id
         WHERE p.user_id = $1
         ORDER BY pp.created_at DESC`,
        [userId]
      )
    ]);

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profile: {
        ...profileRes.rows[0],
        experience: experienceRes.rows,
        projects: projectsRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPERIENCE ====================

exports.getMyExperience = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pe.*
       FROM profile_experience pe
       JOIN profiles p ON pe.profile_id = p.id
       WHERE p.user_id = $1
       ORDER BY pe.is_current DESC, pe.start_date DESC`,
      [req.user.id]
    );
    res.json({ experience: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addExperience = async (req, res, next) => {
  try {
    const { title, company_name, description, start_date, end_date, is_current } = req.body;

    // Get or create profile
    let profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (profile.rows.length === 0) {
      await db.query('INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)', [req.user.id, req.user.email]);
      profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    }

    const result = await db.query(
      `INSERT INTO profile_experience (profile_id, title, company_name, description, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [profile.rows[0].id, title, company_name || null, description || null, start_date, end_date || null, is_current || false]
    );

    logger.info(`Experience added for user: ${req.user.id}`);
    res.status(201).json({ experience: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateExperience = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, company_name, description, start_date, end_date, is_current } = req.body;

    // Verify ownership
    const check = await db.query(
      `SELECT pe.id FROM profile_experience pe
       JOIN profiles p ON pe.profile_id = p.id
       WHERE pe.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    const result = await db.query(
      `UPDATE profile_experience
       SET title = COALESCE($1, title),
           company_name = COALESCE($2, company_name),
           description = COALESCE($3, description),
           start_date = COALESCE($4, start_date),
           end_date = $5,
           is_current = COALESCE($6, is_current)
       WHERE id = $7
       RETURNING *`,
      [title, company_name, description, start_date, end_date, is_current, id]
    );

    res.json({ experience: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteExperience = async (req, res, next) => {
  try {
    const { id } = req.params;

    const check = await db.query(
      `SELECT pe.id FROM profile_experience pe
       JOIN profiles p ON pe.profile_id = p.id
       WHERE pe.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    await db.query('DELETE FROM profile_experience WHERE id = $1', [id]);
    res.json({ message: 'Experience deleted' });
  } catch (error) {
    next(error);
  }
};

// ==================== PROJECTS ====================

exports.getMyProjects = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pp.*
       FROM profile_projects pp
       JOIN profiles p ON pp.profile_id = p.id
       WHERE p.user_id = $1
       ORDER BY pp.created_at DESC`,
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addProject = async (req, res, next) => {
  try {
    const { title, description, project_url, github_url, technologies, image_url } = req.body;

    let profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (profile.rows.length === 0) {
      await db.query('INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)', [req.user.id, req.user.email]);
      profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    }

    const result = await db.query(
      `INSERT INTO profile_projects (profile_id, title, description, project_url, github_url, technologies, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [profile.rows[0].id, title, description || null, project_url || null, github_url || null, technologies || [], image_url || null]
    );

    logger.info(`Project added for user: ${req.user.id}`);
    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, project_url, github_url, technologies, image_url } = req.body;

    const check = await db.query(
      `SELECT pp.id FROM profile_projects pp
       JOIN profiles p ON pp.profile_id = p.id
       WHERE pp.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await db.query(
      `UPDATE profile_projects
       SET title = COALESCE($1, title),
           description = $2,
           project_url = $3,
           github_url = $4,
           technologies = COALESCE($5, technologies),
           image_url = $6
       WHERE id = $7
       RETURNING *`,
      [title, description, project_url, github_url, technologies, image_url, id]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const check = await db.query(
      `SELECT pp.id FROM profile_projects pp
       JOIN profiles p ON pp.profile_id = p.id
       WHERE pp.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.query('DELETE FROM profile_projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};

// ==================== SKILLS ====================

exports.updateSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills) || skills.length > 30) {
      return res.status(400).json({ error: 'Skills must be an array with max 30 items' });
    }

    let profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (profile.rows.length === 0) {
      await db.query('INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)', [req.user.id, req.user.email]);
      profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    }

    const result = await db.query(
      'UPDATE profiles SET skills = $1, updated_at = NOW() WHERE user_id = $2 RETURNING skills',
      [skills, req.user.id]
    );

    res.json({ skills: result.rows[0].skills });
  } catch (error) {
    next(error);
  }
};

exports.addSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array' });
    }

    const result = await db.query(
      "UPDATE profiles SET skills = array_cat(COALESCE(skills, '{}'), $1), updated_at = NOW() WHERE user_id = $2 RETURNING skills",
      [skills, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ skills: result.rows[0].skills });
  } catch (error) {
    next(error);
  }
};

exports.removeSkill = async (req, res, next) => {
  try {
    const { skill } = req.params;

    const result = await db.query(
      `UPDATE profiles
       SET skills = array_remove(skills, $1), updated_at = NOW()
       WHERE user_id = $2
       RETURNING skills`,
      [skill, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ skills: result.rows[0].skills });
  } catch (error) {
    next(error);
  }
};

// ==================== PROFILE COMPLETION ====================

exports.getCompletionStatus = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ completion: 0, missing: ['profile'] });
    }

    const p = result.rows[0];
    const checks = {
      full_name: !!p.full_name,
      bio: !!p.bio,
      avatar_url: !!p.avatar_url,
      phone: !!p.phone,
      city: !!p.city,
      college_name: !!p.college_name,
      course: !!p.course,
      skills: p.skills && p.skills.length > 0,
      linkedin_url: !!p.linkedin_url,
      github_url: !!p.github_url
    };

    const completed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    const completion = Math.round((completed / total) * 100);

    const missing = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    res.json({ completion, missing });
  } catch (error) {
    next(error);
  }
};
