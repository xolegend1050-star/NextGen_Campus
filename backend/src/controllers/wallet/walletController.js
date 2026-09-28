const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getWallet = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({ wallet: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    const wallet = await db.query('SELECT id FROM wallets WHERE user_id = $1', [req.user.id]);
    if (wallet.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    let query = 'SELECT * FROM wallet_transactions WHERE wallet_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = $1';
    const params = [wallet.rows[0].id];

    if (type) {
      query += ` AND transaction_type = $${params.length + 1}`;
      countQuery += ` AND transaction_type = $${params.length + 1}`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [transactions, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      transactions: transactions.rows,
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

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, payment_method, payment_details } = req.body;

    // parseFloat('abc') is NaN, and every NaN comparison is false, so an
    // unvalidated amount slipped past both the balance and minimum checks and
    // then failed inside the INSERT with a numeric type error - a 500 for what
    // is plainly a client-side validation error.
    //
    // The column is numeric, so a fractional amount is legitimate money; only
    // NaN, zero, negatives and non-numbers are rejected.
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    // payment_method is an unconstrained varchar. Only reject a missing or
    // non-string value rather than pinning it to a list, so adding a method
    // later does not silently start failing.
    if (typeof payment_method !== 'string' || !payment_method.trim()) {
      return res.status(400).json({ error: 'payment_method is required' });
    }

    // Get wallet
    const wallet = await db.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (wallet.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.rows[0].is_frozen) {
      return res.status(400).json({ error: 'Wallet is frozen' });
    }

    if (amountNum > parseFloat(wallet.rows[0].balance)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    if (amountNum < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
    }

    // Create withdrawal request
    const result = await db.query(
      `INSERT INTO withdrawal_requests (user_id, wallet_id, amount, payment_method, payment_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, wallet.rows[0].id, amountNum, payment_method, JSON.stringify(payment_details || {})]
    );

    // Lock the amount
    await db.query(
      `UPDATE wallets 
       SET balance = balance - $1, locked_balance = locked_balance + $1
       WHERE id = $2`,
      [amountNum, wallet.rows[0].id]
    );

    // Record transaction
    await db.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', 'Withdrawal requested')`,
      [wallet.rows[0].id, amount, wallet.rows[0].balance, parseFloat(wallet.rows[0].balance) - amount]
    );

    logger.info(`Withdrawal requested: â‚¹${amount} by user ${req.user.id}`);
    res.json({ withdrawal: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Fund escrow for one accepted applicant on a gig.
 * Money leaves the company wallet and is held until release, so the student is
 * guaranteed payment for the work. Requires an accepted application: the
 * student_id is taken from that row rather than from client input.
 */
exports.fundEscrow = async (req, res, next) => {
  try {
    const { gigId } = req.params;
    const { application_id, amount } = req.body;

    if (!application_id) {
      return res.status(400).json({ error: 'application_id is required' });
    }

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (value > 10000000) {
      return res.status(400).json({ error: 'Amount exceeds the maximum allowed' });
    }

    const escrow = await db.withTransaction(async (client) => {
      // Lock the gig row so two concurrent funding requests cannot both pass
      const gig = await client.query(
        'SELECT id, title, company_id, compensation, is_escrow_required FROM gigs WHERE id = $1 FOR UPDATE',
        [gigId]
      );

      if (gig.rows.length === 0) {
        const err = new Error('Gig not found');
        err.status = 404;
        throw err;
      }
      if (gig.rows[0].company_id !== req.user.id) {
        const err = new Error('Not your gig');
        err.status = 403;
        throw err;
      }

      // The application must exist, belong to this gig, and be accepted
      const app = await client.query(
        `SELECT id, student_id, status FROM gig_applications
          WHERE id = $1 AND gig_id = $2`,
        [application_id, gigId]
      );

      if (app.rows.length === 0) {
        const err = new Error('Application not found for this gig');
        err.status = 404;
        throw err;
      }
      if (app.rows[0].status !== 'accepted') {
        const err = new Error('Only an accepted applicant can be funded');
        err.status = 400;
        throw err;
      }

      // One live escrow per application
      const dupe = await client.query(
        "SELECT id FROM escrow_transactions WHERE application_id = $1 AND status = 'locked'",
        [application_id]
      );
      if (dupe.rows.length > 0) {
        const err = new Error('Escrow is already funded for this application');
        err.status = 409;
        throw err;
      }

      // Lock the wallet row, then re-check the balance under the lock
      const wallet = await client.query(
        'SELECT id, balance, is_frozen FROM wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );
      if (wallet.rows.length === 0) {
        const err = new Error('Wallet not found');
        err.status = 404;
        throw err;
      }
      if (wallet.rows[0].is_frozen) {
        const err = new Error('Wallet is frozen');
        err.status = 400;
        throw err;
      }

      const balanceBefore = parseFloat(wallet.rows[0].balance);
      if (value > balanceBefore) {
        const err = new Error('Insufficient balance');
        err.status = 400;
        throw err;
      }
      const balanceAfter = balanceBefore - value;

      // Warn when the funded amount drifts far from the advertised figure, but
      // do not block: the parties can legitimately agree a different number.
      if (parseFloat(gig.rows[0].compensation) > 0) {
        const advertised = parseFloat(gig.rows[0].compensation);
        if (Math.abs(value - advertised) / advertised > 0.5) {
          logger.warn(
            `Escrow â‚¹${value} differs from advertised compensation â‚¹${advertised} for gig ${gigId}`
          );
        }
      }

      const created = await client.query(
        `INSERT INTO escrow_transactions
           (gig_id, application_id, company_id, student_id, amount, status, auto_release_at)
         VALUES ($1, $2, $3, $4, $5, 'locked', NOW() + INTERVAL '7 days')
         RETURNING *`,
        [gigId, application_id, req.user.id, app.rows[0].student_id, value]
      );

      await client.query(
        'UPDATE wallets SET balance = $1 WHERE id = $2',
        [balanceAfter, wallet.rows[0].id]
      );

      await client.query(
        `INSERT INTO wallet_transactions
           (wallet_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, description)
         VALUES ($1, 'escrow_lock', $2, $3, $4, 'escrow', $5, $6)`,
        [
          wallet.rows[0].id, value, balanceBefore, balanceAfter,
          created.rows[0].id, `Escrow funded for gig: ${gig.rows[0].title}`
        ]
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'escrow_funded', 'Escrow funded', $2, $3)`,
        [
          app.rows[0].student_id,
          `A company has funded â‚¹${value} into escrow for your gig`,
          JSON.stringify({ gig_id: gigId, amount: value, escrow_id: created.rows[0].id })
        ]
      );

      return created.rows[0];
    });

    logger.info(`Escrow funded: â‚¹${value} for gig ${gigId} application ${application_id}`);
    res.status(201).json({ escrow });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

/** List escrows visible to the caller, as company or as student. */
exports.listEscrows = async (req, res, next) => {
  try {
    const { status } = req.query;

    const params = [];
    let where = '(e.company_id = $1 OR e.student_id = $1)';
    params.push(req.user.id);

    if (status) {
      params.push(status);
      where += ` AND e.status = $${params.length}`;
    }

    const result = await db.query(
      `SELECT e.*, g.title AS gig_title, cp.company_name
         FROM escrow_transactions e
         LEFT JOIN gigs g ON g.id = e.gig_id
         LEFT JOIN company_profiles cp ON cp.user_id = e.company_id
        WHERE ${where}
        ORDER BY e.created_at DESC
        LIMIT 100`,
      params
    );

    res.json({ escrows: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Release held funds to the student's wallet.
 *
 * Previously unreachable: fundEscrow never set student_id, so the wallet
 * lookup used a NULL user_id and always failed. Also now idempotent (a repeat
 * call reports the existing release rather than double-paying) and requires a
 * submitted deliverable unless a force flag is passed.
 */
exports.releaseEscrow = async (req, res, next) => {
  try {
    const { gigId } = req.params;
    const { force } = req.body || {};

    const released = await db.withTransaction(async (client) => {
      const escrow = await client.query(
        `SELECT * FROM escrow_transactions
          WHERE gig_id = $1 AND company_id = $2
          ORDER BY created_at DESC LIMIT 1
          FOR UPDATE`,
        [gigId, req.user.id]
      );

      if (escrow.rows.length === 0) {
        const err = new Error('No escrow found for this gig');
        err.status = 404;
        throw err;
      }

      const row = escrow.rows[0];

      // Idempotency: a released or refunded escrow is a no-op, not a re-payment
      if (row.status === 'released') {
        return { escrow: row, alreadyReleased: true };
      }
      if (row.status === 'refunded') {
        const err = new Error('This escrow was refunded and cannot be released');
        err.status = 400;
        throw err;
      }
      if (row.status !== 'locked') {
        const err = new Error(`Escrow is ${row.status}, not locked`);
        err.status = 400;
        throw err;
      }

      // Require a submitted deliverable so funds cannot be paid out for nothing
      if (!force) {
        const deliverable = await client.query(
          `SELECT id FROM gig_deliverables
            WHERE gig_id = $1 AND student_id = $2 LIMIT 1`,
          [gigId, row.student_id]
        );
        if (deliverable.rows.length === 0) {
          const err = new Error('The student has not submitted any work yet');
          err.status = 400;
          throw err;
        }
      }

      const amount = parseFloat(row.amount);

      const studentWallet = await client.query(
        'SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [row.student_id]
      );
      if (studentWallet.rows.length === 0) {
        const err = new Error('Student wallet not found');
        err.status = 400;
        throw err;
      }

      const balanceBefore = parseFloat(studentWallet.rows[0].balance);
      const balanceAfter = balanceBefore + amount;

      await client.query(
        'UPDATE wallets SET balance = $1, total_earned = total_earned + $2 WHERE id = $3',
        [balanceAfter, amount, studentWallet.rows[0].id]
      );

      const updated = await client.query(
        `UPDATE escrow_transactions
            SET status = 'released', released_at = NOW(), released_to_wallet = true
          WHERE id = $1
          RETURNING *`,
        [row.id]
      );

      await client.query(
        `INSERT INTO wallet_transactions
           (wallet_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, description)
         VALUES ($1, 'escrow_release', $2, $3, $4, 'escrow', $5, $6)`,
        [studentWallet.rows[0].id, amount, balanceBefore, balanceAfter, row.id, 'Escrow payment released']
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'payment_received', 'Payment received', $2, $3)`,
        [
          row.student_id,
          `You received â‚¹${amount} for completing a gig`,
          JSON.stringify({ gig_id: gigId, amount, escrow_id: row.id })
        ]
      );

      return { escrow: updated.rows[0], alreadyReleased: false };
    });

    logger.info(`Escrow released: ${released.escrow.amount} for gig ${gigId}`);
    res.json({
      message: released.alreadyReleased
        ? 'Escrow was already released'
        : 'Escrow released successfully',
      escrow: released.escrow,
      alreadyReleased: released.alreadyReleased
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * Return escrowed funds to the company, e.g. when a gig is cancelled or no
 * longer needs the work. Without this the money is stranded in escrow forever.
 */
exports.refundEscrow = async (req, res, next) => {
  try {
    const { gigId } = req.params;
    const { reason } = req.body || {};

    const refund = await db.withTransaction(async (client) => {
      const escrow = await client.query(
        `SELECT * FROM escrow_transactions
          WHERE gig_id = $1 AND company_id = $2 AND status = 'locked'
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [gigId, req.user.id]
      );

      if (escrow.rows.length === 0) {
        const err = new Error('No locked escrow found for this gig');
        err.status = 404;
        throw err;
      }

      const row = escrow.rows[0];
      const amount = parseFloat(row.amount);

      const wallet = await client.query(
        'SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );
      if (wallet.rows.length === 0) {
        const err = new Error('Wallet not found');
        err.status = 404;
        throw err;
      }

      const balanceBefore = parseFloat(wallet.rows[0].balance);
      const balanceAfter = balanceBefore + amount;

      await client.query('UPDATE wallets SET balance = $1 WHERE id = $2', [balanceAfter, wallet.rows[0].id]);

      const updated = await client.query(
        `UPDATE escrow_transactions
            SET status = 'refunded', refunded_at = NOW(), refund_reason = $2
          WHERE id = $1 RETURNING *`,
        [row.id, (reason || 'Refunded by company').slice(0, 500)]
      );

      await client.query(
        `INSERT INTO wallet_transactions
           (wallet_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, description)
         VALUES ($1, 'refund', $2, $3, $4, 'escrow', $5, $6)`,
        [wallet.rows[0].id, amount, balanceBefore, balanceAfter, row.id, 'Escrow refunded to company']
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'escrow_refunded', 'Escrow refunded', $2, $3)`,
        [
          row.student_id,
          'The company refunded the escrowed payment for this gig',
          JSON.stringify({ gig_id: gigId, amount, escrow_id: row.id })
        ]
      );

      return updated.rows[0];
    });

    logger.info(`Escrow refunded: ${refund.amount} for gig ${gigId}`);
    res.json({ message: 'Escrow refunded', escrow: refund });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};
