/**
 * Daily rollup into platform_metrics.
 *
 * The analytics module reads this table for historical platform figures, but
 * nothing ever wrote to it, so it stayed empty and the dashboard had no
 * history to chart. Run from a scheduler (Render cron job, GitHub Action) or
 * manually with `npm run metrics:rollup`.
 *
 * platform_metrics is a key/value table: one row per metric per day, with a
 * unique constraint on (metric_name, metric_date). The upsert below relies on
 * that constraint, so re-running updates the day rather than duplicating it.
 *
 * Yesterday is rolled up, never today, so a partial current day cannot become
 * a permanent data point.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = require('./database');
const logger = require('../utils/logger');

const rollup = async (client) => {
  const { rows } = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE - 1)::int AS new_users,
      (SELECT COUNT(*) FROM users WHERE is_active AND is_banned = false)::int AS total_active_users,
      (SELECT COUNT(*) FROM users WHERE last_seen_at::date = CURRENT_DATE - 1)::int AS active_users,
      (SELECT COUNT(*) FROM doubts WHERE created_at::date = CURRENT_DATE - 1)::int AS new_doubts,
      (SELECT COUNT(*) FROM doubt_answers WHERE created_at::date = CURRENT_DATE - 1)::int AS new_answers,
      (SELECT COUNT(*) FROM gig_applications WHERE created_at::date = CURRENT_DATE - 1)::int AS new_applications,
      (SELECT COUNT(*) FROM mentorship_sessions WHERE created_at::date = CURRENT_DATE - 1)::int AS new_sessions,
      (SELECT COUNT(*) FROM messages WHERE created_at::date = CURRENT_DATE - 1)::int AS new_messages,
      (SELECT COUNT(*) FROM gigs WHERE created_at::date = CURRENT_DATE - 1)::int AS new_gigs,
      (SELECT COALESCE(SUM(amount), 0) FROM escrow_transactions WHERE released_at::date = CURRENT_DATE - 1) AS amount_released,
      (SELECT COALESCE(SUM(amount), 0) FROM escrow_transactions
         WHERE created_at::date = CURRENT_DATE - 1 AND status = 'locked') AS amount_in_escrow
  `);

  const m = rows[0];

  const metrics = {
    new_users: m.new_users,
    total_active_users: m.total_active_users,
    active_users: m.active_users,
    new_doubts: m.new_doubts,
    new_answers: m.new_answers,
    new_applications: m.new_applications,
    new_sessions: m.new_sessions,
    new_messages: m.new_messages,
    new_gigs: m.new_gigs,
    amount_released: m.amount_released,
    amount_in_escrow: m.amount_in_escrow
  };

  for (const [name, value] of Object.entries(metrics)) {
    await client.query(
      `INSERT INTO platform_metrics (metric_name, metric_value, metric_date, metadata)
       VALUES ($1, $2, CURRENT_DATE - 1, $3)
       ON CONFLICT (metric_name, metric_date) DO UPDATE
         SET metric_value = EXCLUDED.metric_value,
             metadata = EXCLUDED.metadata`,
      [name, value, JSON.stringify({ rolled_up_at: new Date().toISOString() })]
    );
  }

  return metrics;
};

(async () => {
  if (require.main === module) {
    try {
      const m = await db.withTransaction(rollup);
      logger.info('platform_metrics rollup complete', { metrics: Object.keys(m).length });
      console.log('✅ platform_metrics rollup complete for yesterday:');
      console.table(m);
      process.exit(0);
    } catch (err) {
      console.error('❌ rollup failed:', err.message);
      process.exit(1);
    }
  }
  module.exports = { rollup };
})();
