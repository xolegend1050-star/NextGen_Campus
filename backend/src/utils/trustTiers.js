const db = require('../config/database');
const logger = require('./logger');

// Trust tier thresholds
const TIERS = {
  new: { min: 0, max: 29, label: 'New' },
  rising: { min: 30, max: 69, label: 'Rising' },
  featured: { min: 70, max: Infinity, label: 'Featured' }
};

// Points awarded per action
const POINTS = {
  verification_approved: { student_college_email: 25, student_id_card: 25, alumni_linkedin: 35, alumni_college_id: 35, company_domain: 50, company_gst: 50 },
  doubt_posted: 5,
  doubt_answered: 10,
  answer_accepted: 20,
  gig_completed: 30,
  mentor_session_completed: 25,
  profile_completed: 10,
  daily_login_streak_7: 15,
  daily_login_streak_30: 50,
  interview_practice: 15
};

// Time-decay: lose this many points per day of inactivity (after 30-day grace period)
const DECAY_RATE = 2;
const GRACE_PERIOD_DAYS = 30;

function getTier(score) {
  if (score >= TIERS.featured.min) return TIERS.featured;
  if (score >= TIERS.rising.min) return TIERS.rising;
  return TIERS.new;
}

function calculateDecay(lastActiveAt) {
  if (!lastActiveAt) return 0;
  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const daysSinceActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
  const decayDays = Math.max(0, daysSinceActive - GRACE_PERIOD_DAYS);
  return decayDays * DECAY_RATE;
}

async function recalculateTrustScore(userId) {
  const profile = await db.query(
    `SELECT p.trust_score, u.last_seen_at
     FROM profiles p
     JOIN users u ON p.user_id = u.id
     WHERE p.user_id = $1`,
    [userId]
  );
  if (profile.rows.length === 0) return null;

  // Sum all earned points from history
  const history = await db.query(
    'SELECT COALESCE(SUM(change_amount), 0) as total_earned FROM trust_score_history WHERE user_id = $1 AND change_amount > 0',
    [userId]
  );

  const earned = parseInt(history.rows[0].total_earned) || 0;
  const decay = calculateDecay(profile.rows[0].last_seen_at);
  const newScore = Math.max(0, earned - decay);
  const oldScore = profile.rows[0].trust_score;

  if (newScore !== oldScore) {
    const newTier = getTier(newScore).label.toLowerCase();
    await db.query(
      'UPDATE profiles SET trust_score = $1, talent_tier = $2 WHERE user_id = $3',
      [newScore, newTier, userId]
    );

    // Record the decay if applicable
    if (decay > 0 && newScore < oldScore) {
      await db.query(
        `INSERT INTO trust_score_history (user_id, old_score, new_score, change_amount, change_reason, reference_type)
         VALUES ($1, $2, $3, $4, 'time_decay', 'system')`,
        [userId, oldScore, newScore, -decay]
      );
    }
  }

  const tier = getTier(newScore);
  return { score: newScore, oldScore, tier: tier.label, decay };
}

async function awardPoints(userId, actionType, referenceType = null, referenceId = null) {
  let points = typeof POINTS[actionType] === 'number' ? POINTS[actionType] : null;

  // Handle verification-specific points
  if (typeof POINTS[actionType] === 'object' && referenceType) {
    points = POINTS[actionType][referenceType] || 0;
  }

  if (!points || points <= 0) return null;

  const profile = await db.query(
    'SELECT trust_score FROM profiles WHERE user_id = $1',
    [userId]
  );
  if (profile.rows.length === 0) return null;

  const oldScore = profile.rows[0].trust_score;
  const newScore = Math.min(oldScore + points, 200); // Cap at 200

  const newTier = getTier(newScore).label.toLowerCase();
  await db.query(
    'UPDATE profiles SET trust_score = $1, talent_tier = $2 WHERE user_id = $3',
    [newScore, newTier, userId]
  );

  await db.query(
    `INSERT INTO trust_score_history (user_id, old_score, new_score, change_amount, change_reason, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, oldScore, newScore, points, actionType, referenceType, referenceId]
  );

  const tier = getTier(newScore);
  logger.info(`Trust score updated for ${userId}: ${oldScore} → ${newScore} (+${points}, tier: ${tier.label})`);
  return { score: newScore, oldScore, points, tier: tier.label };
}

module.exports = { TIERS, POINTS, getTier, calculateDecay, recalculateTrustScore, awardPoints };
