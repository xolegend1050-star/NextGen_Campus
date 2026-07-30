const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { updateProfileValidation } = require('../validators/profile');

/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     tags: [Profiles]
 *     summary: Get current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
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
});

/**
 * @swagger
 * /api/profiles/me:
 *   put:
 *     tags: [Profiles]
 *     summary: Update current user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               city:
 *                 type: string
 *               college_name:
 *                 type: string
 *               skills:
 *                 type: string
 *               github_url:
 *                 type: string
 *               linkedin_url:
 *                 type: string
 *               portfolio_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/me', authenticate, updateProfileValidation, async (req, res, next) => {
  try {
    const {
      full_name, bio, city, college_name, skills,
      github_url, linkedin_url, portfolio_url,
      graduation_year, company_name, designation, years_of_experience
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name !== undefined) { updates.push(`full_name = $${paramCount}`); values.push(full_name); paramCount++; }
    if (bio !== undefined) { updates.push(`bio = $${paramCount}`); values.push(bio); paramCount++; }
    if (city !== undefined) { updates.push(`city = $${paramCount}`); values.push(city); paramCount++; }
    if (college_name !== undefined) { updates.push(`college_name = $${paramCount}`); values.push(college_name); paramCount++; }
    if (skills !== undefined) { updates.push(`skills = $${paramCount}`); values.push(skills); paramCount++; }
    if (github_url !== undefined) { updates.push(`github_url = $${paramCount}`); values.push(github_url); paramCount++; }
    if (linkedin_url !== undefined) { updates.push(`linkedin_url = $${paramCount}`); values.push(linkedin_url); paramCount++; }
    if (portfolio_url !== undefined) { updates.push(`portfolio_url = $${paramCount}`); values.push(portfolio_url); paramCount++; }
    if (graduation_year !== undefined) { updates.push(`graduation_year = $${paramCount}`); values.push(graduation_year); paramCount++; }
    if (company_name !== undefined) { updates.push(`company_name = $${paramCount}`); values.push(company_name); paramCount++; }
    if (designation !== undefined) { updates.push(`designation = $${paramCount}`); values.push(designation); paramCount++; }
    if (years_of_experience !== undefined) { updates.push(`years_of_experience = $${paramCount}`); values.push(years_of_experience); paramCount++; }

    updates.push(`updated_at = NOW()`);

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
      await db.query('INSERT INTO profiles (user_id) VALUES ($1)', [req.user.id]);
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
});

/**
 * @swagger
 * /api/profiles/{userId}:
 *   get:
 *     tags: [Profiles]
 *     summary: Get user profile by ID (public)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const result = await db.query(
      `SELECT p.full_name, p.avatar_url, p.bio, p.city, p.college_name,
              p.skills, p.trust_score, p.talent_tier, p.graduation_year,
              p.github_url, p.linkedin_url, p.portfolio_url,
              u.role, u.created_at
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
