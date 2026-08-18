const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getTrustScore = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      `SELECT trust_score, talent_tier FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Check company
      const company = await db.query(
        'SELECT trust_score, is_verified FROM company_profiles WHERE user_id = $1',
        [userId]
      );

      if (company.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        trustScore: parseFloat(company.rows[0].trust_score),
        isVerified: company.rows[0].is_verified
      });
    }

    const talentTierThresholds = {
      new: 0,
      rising: 30,
      featured: 70
    };

    const score = parseFloat(result.rows[0].trust_score);
    let calculatedTier = 'new';
    if (score >= talentTierThresholds.featured) calculatedTier = 'featured';
    else if (score >= talentTierThresholds.rising) calculatedTier = 'rising';

    res.json({
      trustScore: score,
      talentTier: calculatedTier,
      nextTier: calculatedTier === 'featured' ? null : calculatedTier === 'rising' ? 'featured' : 'rising',
      pointsToNextTier: calculatedTier === 'featured' ? 0 : calculatedTier === 'rising' ? talentTierThresholds.featured - score : talentTierThresholds.rising - score
    });
  } catch (error) {
    next(error);
  }
};

exports.getTrustScoreHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const result = await db.query(
      `SELECT * FROM trust_score_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ history: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.reportCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { reason, description } = req.body;

    // Check if company exists
    const company = await db.query(
      'SELECT id FROM company_profiles WHERE user_id = $1',
      [companyId]
    );

    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for existing report
    const existingReport = await db.query(
      'SELECT id FROM company_reports WHERE company_id = $1 AND reported_by = $2 AND status = $3',
      [companyId, req.user.id, 'pending']
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reported this company' });
    }

    const result = await db.query(
      `INSERT INTO company_reports (company_id, reported_by, reason, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, req.user.id, reason, description || null]
    );

    // If multiple reports, consider flagging company
    const reportCount = await db.query(
      'SELECT COUNT(*) FROM company_reports WHERE company_id = $1',
      [companyId]
    );

    if (parseInt(reportCount.rows[0].count) >= 3) {
      // Auto-flag company for admin review
      await db.query(
        `INSERT INTO flagged_content (content_type, content_id, reported_by, reason)
         VALUES ('company', $1, $2, 'Multiple reports received')`,
        [companyId, req.user.id]
      );
    }

    logger.info(`Company reported: ${companyId} by user ${req.user.id}`);
    res.status(201).json({ report: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
