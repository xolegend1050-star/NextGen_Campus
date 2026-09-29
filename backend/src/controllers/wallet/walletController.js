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

      // The money leaves "available" and becomes "locked" at the same moment.
      //
      // Only the available side was being decremented, so a company that funded
      // escrow saw the amount simply disappear: its wallet reported the same
      // locked_balance afterwards, and balance + locked_balance no longer
      // equalled the funds it actually held. requestWithdrawal has always moved
      // both sides together, and escrow must do the same or the wallet is not a
      // truthful statement of what the company owns.
      await client.query(
        'UPDATE wallets SET balance = $1, locked_balance = locked_balance + $2 WHERE id = $3',
        [balanceAfter, value, wallet.rows[0].id]
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
    const { force, application_id: applicationId } = req.body || {};

    const released = await db.withTransaction(async (client) => {
      // A gig can have several accepted applicants, each with its own escrow.
      // Selecting the newest one unconditionally meant a company could only ever
      // pay the most recent applicant, with no way to name anyone else, so
      // application_id is honoured when supplied.
      const escrow = await client.query(
        applicationId
          ? `SELECT * FROM escrow_transactions
              WHERE gig_id = $1 AND company_id = $2 AND application_id = $3
              FOR UPDATE`
          : `SELECT * FROM escrow_transactions
              WHERE gig_id = $1 AND company_id = $2
              ORDER BY created_at DESC LIMIT 1
              FOR UPDATE`,
        applicationId ? [gigId, req.user.id, applicationId] : [gigId, req.user.id]
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

      // Require a submitted deliverable so funds cannot be paid out for nothing.
      //
      // The check protects the student, so the company paying out must not be
      // able to switch it off: force is honoured only for an admin, who is not a
      // party to the gig. A company that passes force is refused rather than
      // silently overridden.
      if (force) {
        if (req.user.role !== 'admin') {
          const err = new Error('Only an administrator can release escrow without submitted work');
          err.status = 403;
          throw err;
        }
        logger.warn(`Admin ${req.user.id} force released escrow ${row.id} for gig ${gigId} with no deliverable`);
      } else {
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

      // The escrow is no longer held, so it leaves the company's locked side and
      // becomes the student's spendable balance. Without this the company's
      // locked_balance would stay raised forever and its wallet would keep
      // claiming money it had already paid out.
      await client.query(
        `UPDATE wallets
            SET locked_balance = GREATEST(locked_balance - $1, 0)
          WHERE user_id = $2`,
        [amount, row.company_id]
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
    const { reason, application_id: applicationId } = req.body || {};

    const refund = await db.withTransaction(async (client) => {
      // As with release, a gig may hold several escrows, so the applicant can be
      // named. Falling back to the newest keeps the old behaviour for callers
      // that do not send an application_id.
      const escrow = await client.query(
        applicationId
          ? `SELECT * FROM escrow_transactions
              WHERE gig_id = $1 AND company_id = $2 AND status = 'locked' AND application_id = $3
              FOR UPDATE`
          : `SELECT * FROM escrow_transactions
              WHERE gig_id = $1 AND company_id = $2 AND status = 'locked'
              ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        applicationId ? [gigId, req.user.id, applicationId] : [gigId, req.user.id]
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

      // The money comes back to available and is no longer held, so the locked
      // side drops at the same time. GREATEST guards against a negative balance
      // if this is ever retried against an already-unlocked row.
      await client.query(
        'UPDATE wallets SET balance = $1, locked_balance = GREATEST(locked_balance - $2, 0) WHERE id = $3',
        [balanceAfter, amount, wallet.rows[0].id]
      );

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

/**
 * Submit the work for a gig.
 *
 * releaseEscrow will not pay out until a deliverable exists, and until this
 * action there was no way to create one, so the only route to a payment was to
 * pass force, which is now admin-only. The student is taken from the accepted
 * application rather than from the request body, so nobody can submit work as
 * somebody else.
 */
exports.submitDeliverable = async (req, res, next) => {
  try {
    const { gigId } = req.params;
    const { title, description, file_url: fileUrl, file_name: fileName } = req.body || {};

    if (typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'A title of at least 3 characters is required' });
    }
    if (fileUrl !== undefined && fileUrl !== null && String(fileUrl).trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(String(fileUrl));
      } catch {
        return res.status(400).json({ error: 'file_url must be a valid URL' });
      }
    }

    const created = await db.withTransaction(async (client) => {
      // The applicant must be accepted for this gig, which is the same condition
      // escrow funding requires.
      const app = await client.query(
        `SELECT id, student_id FROM gig_applications
          WHERE gig_id = $1 AND student_id = $2 AND status = 'accepted'
          ORDER BY updated_at DESC LIMIT 1`,
        [gigId, req.user.id]
      );
      if (app.rows.length === 0) {
        const err = new Error('You can only submit work for a gig you have been accepted for');
        err.status = 403;
        throw err;
      }

      const row = await client.query(
        `INSERT INTO gig_deliverables (gig_id, student_id, title, description, file_url, file_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
         RETURNING *`,
        [
          gigId, req.user.id, title.trim(),
          description ? String(description).slice(0, 5000) : null,
          fileUrl ? String(fileUrl).slice(0, 500) : null,
          fileName ? String(fileName).slice(0, 255) : null
        ]
      );

      const company = await client.query(
        'SELECT company_id FROM gigs WHERE id = $1',
        [gigId]
      );
      if (company.rows.length) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, 'deliverable_submitted', 'Work submitted', $2, $3)`,
          [
            company.rows[0].company_id,
            `${req.user.name || 'A student'} submitted work for your gig`,
            JSON.stringify({ gig_id: gigId, deliverable_id: row.rows[0].id })
          ]
        );
      }

      return row.rows[0];
    });

    logger.info(`Deliverable submitted for gig ${gigId} by user ${req.user.id}`);
    res.status(201).json({ deliverable: created });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

/** List withdrawal requests, for an administrator to act on. */
exports.listWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let text = 'WHERE 1=1';
    if (status) {
      params.push(status);
      text += ` AND wr.status = $${params.length}`;
    }
    params.push(Number(limit), offset);

    const rows = await db.query(
      `SELECT wr.*, u.email, w.balance, w.locked_balance
         FROM withdrawal_requests wr
         JOIN public.users u ON u.id = wr.user_id
         JOIN wallets w ON w.id = wr.wallet_id
         ${text}
        ORDER BY wr.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const total = await db.query(`SELECT count(*)::int AS n FROM withdrawal_requests wr ${text}`, params.slice(0, -2));

    res.json({ withdrawals: rows.rows, total: total.rows[0].n, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or reject a withdrawal.
 *
 * The amount was moved into locked_balance when the request was made, so
 * approving only has to release that hold: the money has already left the
 * available balance, and re-debiting it here would take the user down twice.
 * Rejecting returns it, because the hold is not a real payment.
 */
exports.processWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body || {};

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }

    const result = await db.withTransaction(async (client) => {
      const row = await client.query(
        'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (row.rows.length === 0) {
        const err = new Error('Withdrawal request not found');
        err.status = 404;
        throw err;
      }
      const wr = row.rows[0];
      if (wr.status !== 'pending') {
        const err = new Error(`This withdrawal was already ${wr.status}`);
        err.status = 409;
        throw err;
      }

      const amount = parseFloat(wr.amount);
      const wallet = await client.query(
        'SELECT id, balance, locked_balance FROM wallets WHERE id = $1 FOR UPDATE',
        [wr.wallet_id]
      );
      if (wallet.rows.length === 0) {
        const err = new Error('Wallet not found');
        err.status = 404;
        throw err;
      }

      if (action === 'approve') {
        // The money leaves the hold; the available balance was reduced at request
        // time and stays reduced, because it is now genuinely paid out.
        await client.query(
          'UPDATE wallets SET locked_balance = GREATEST(locked_balance - $1, 0), total_withdrawn = total_withdrawn + $1 WHERE id = $2',
          [amount, wallet.rows[0].id]
        );
        await client.query(
          // PostgreSQL does not accept ORDER BY / LIMIT on an UPDATE directly;
          // the row has to be picked in a CTE first. Matching on the amount as
          // well as the wallet is what ties the ledger entry to this request,
          // since the withdrawal transaction is not linked by reference_id.
          `WITH target AS (
             SELECT id FROM wallet_transactions
              WHERE wallet_id = $1
                AND transaction_type = 'withdrawal'
                AND status = 'pending'
                AND amount = $2
              ORDER BY created_at DESC
              LIMIT 1
           )
           UPDATE wallet_transactions t
              SET status = 'completed', description = 'Withdrawal paid out'
             FROM target
            WHERE t.id = target.id`,
          [wallet.rows[0].id, amount]
        );
      } else {
        // Nothing was paid, so the hold goes back to the user as available funds.
        await client.query(
          'UPDATE wallets SET balance = balance + $1, locked_balance = GREATEST(locked_balance - $1, 0) WHERE id = $2',
          [amount, wallet.rows[0].id]
        );
        await client.query(
          `WITH target AS (
             SELECT id FROM wallet_transactions
              WHERE wallet_id = $1
                AND transaction_type = 'withdrawal'
                AND status = 'pending'
                AND amount = $2
              ORDER BY created_at DESC
              LIMIT 1
           )
           UPDATE wallet_transactions t
              SET status = 'failed', description = 'Withdrawal rejected'
             FROM target
            WHERE t.id = target.id`,
          [wallet.rows[0].id, amount]
        );
      }

      const updated = await client.query(
        `UPDATE withdrawal_requests
            SET status = $1, processed_by = $2, processed_at = NOW(), rejection_reason = $3
          WHERE id = $4 RETURNING *`,
        [action === 'approve' ? 'approved' : 'rejected', req.user.id,
         action === 'reject' ? String(reason || 'Rejected by administrator').slice(0, 500) : null, id]
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          wr.user_id,
          action === 'approve' ? 'withdrawal_approved' : 'withdrawal_rejected',
          action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected',
          action === 'approve'
            ? `Your withdrawal of ${amount} has been paid out`
            : `Your withdrawal of ${amount} was rejected and the amount is back in your balance`,
          JSON.stringify({ withdrawal_id: id, amount })
        ]
      );

      return updated.rows[0];
    });

    logger.info(`Withdrawal ${id} ${action}d by admin ${req.user.id}`);
    res.json({ message: `Withdrawal ${action}d`, withdrawal: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};
