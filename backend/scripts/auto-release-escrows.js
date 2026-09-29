/**
 * Releases escrow that has passed its auto_release_at date.
 *
 * fundEscrow sets auto_release_at to seven days out, but nothing ever read that
 * column, so a company that accepted a student and then went quiet would leave
 * the student's money locked in escrow indefinitely. The column promised a
 * guarantee the system did not keep.
 *
 * This script is that guarantee. Run it from a scheduler; the Render service is
 * declared as a cron job in render.yaml, so it runs every few hours on its own.
 *
 *   node scripts/auto-release-escrows.js          report only, changes nothing
 *   node scripts/auto-release-escrows.js --apply  actually release
 *
 * Refunds are deliberately not done here. Auto-releasing pays a student, which
 * is the side that needs protecting, so a job that pays out unattended should
 * be explicit about it. Default is report-only for that reason.
 */
require('dotenv').config();
const db = require('../src/config/database');

const APPLY = process.argv.includes('--apply');
const STALE_DAYS = 7;

// Only gig students, never a company or an admin.
const RELEASEABLE = ['student', 'alumni'];

async function main() {
  const rows = await db.query(
    `SELECT e.id, e.gig_id, e.amount, e.auto_release_at, e.created_at,
            g.title AS gig_title, u.email AS student_email,
            EXTRACT(DAY FROM (NOW() - e.auto_release_at)) AS days_overdue
       FROM escrow_transactions e
       JOIN gigs g ON g.id = e.gig_id
       JOIN public.users u ON u.id = e.student_id
      WHERE e.status = 'locked'
        AND e.auto_release_at IS NOT NULL
        AND e.auto_release_at <= NOW()
        AND u.role = ANY($1)
      ORDER BY e.auto_release_at ASC`,
    [RELEASEABLE]
  );

  console.log('escrows past their auto-release date: ' + rows.rows.length);
  if (!rows.rows.length) {
    console.log('nothing to do');
    return;
  }

  for (const e of rows.rows) {
    console.log(
      `  gig "${e.gig_title}"  Rs ${e.amount}  to ${e.student_email}  ` +
      `${e.days_overdue} day(s) overdue`
    );
  }

  if (!APPLY) {
    console.log('\nreport only. re-run with --apply to release them');
    return;
  }

  let released = 0;
  let skipped = 0;

  for (const e of rows.rows) {
    try {
      // One transaction per escrow, each locking its own rows, so a single bad
      // row cannot roll back the whole batch.
      await db.withTransaction(async (client) => {
        const fresh = await client.query(
          `SELECT * FROM escrow_transactions WHERE id = $1 FOR UPDATE`,
          [e.id]
        );
        if (!fresh.rows.length) throw new Error('escrow disappeared');
        const row = fresh.rows[0];
        if (row.status !== 'locked') throw new Error('already ' + row.status);

        const amount = parseFloat(row.amount);

        const wallet = await client.query(
          'SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE',
          [row.student_id]
        );
        if (!wallet.rows.length) throw new Error('student has no wallet');

        const before = parseFloat(wallet.rows[0].balance);
        await client.query(
          'UPDATE wallets SET balance = $1, total_earned = total_earned + $2 WHERE id = $3',
          [before + amount, amount, wallet.rows[0].id]
        );

        // The hold leaves the company at the same moment it becomes spendable for
        // the student, matching the manual release path.
        await client.query(
          'UPDATE wallets SET locked_balance = GREATEST(locked_balance - $1, 0) WHERE user_id = $2',
          [amount, row.company_id]
        );

        await client.query(
          `UPDATE escrow_transactions
              SET status = 'released', released_at = NOW(), released_to_wallet = true
            WHERE id = $1`,
          [e.id]
        );

        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, transaction_type, amount, balance_before, balance_after,
              reference_type, reference_id, description)
           VALUES ($1, 'escrow_release', $2, $3, $4, 'escrow', $5, $6)`,
          [wallet.rows[0].id, amount, before, before + amount, e.id,
           'Escrow released automatically after the auto-release date']
        );

        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, 'payment_received', 'Payment received', $2, $3)`,
          [row.student_id,
           `Rs ${amount} was released to you automatically after ${STALE_DAYS} days`,
           JSON.stringify({ gig_id: row.gig_id, amount, escrow_id: e.id, automatic: true })]
        );
      });
      released++;
      console.log('  released ' + e.id);
    } catch (err) {
      // One failure must not stop the rest.
      skipped++;
      console.warn('  skipped ' + e.id + ': ' + err.message);
    }
  }

  console.log(`\nreleased ${released}, skipped ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('auto-release failed: ' + err.message);
    process.exit(1);
  });
