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

    if (parseFloat(amount) > parseFloat(wallet.rows[0].balance)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    if (parseFloat(amount) < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
    }

    // Create withdrawal request
    const result = await db.query(
      `INSERT INTO withdrawal_requests (user_id, wallet_id, amount, payment_method, payment_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, wallet.rows[0].id, amount, payment_method, JSON.stringify(payment_details || {})]
    );

    // Lock the amount
    await db.query(
      `UPDATE wallets 
       SET balance = balance - $1, locked_balance = locked_balance + $1
       WHERE id = $2`,
      [amount, wallet.rows[0].id]
    );

    // Record transaction
    await db.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', 'Withdrawal requested')`,
      [wallet.rows[0].id, amount, wallet.rows[0].balance, parseFloat(wallet.rows[0].balance) - amount]
    );

    logger.info(`Withdrawal requested: ₹${amount} by user ${req.user.id}`);
    res.json({ withdrawal: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.fundEscrow = async (req, res, next) => {
  try {
    const { gigId } = req.params;
    const { amount } = req.body;

    // Check if gig exists and belongs to company
    const gig = await db.query(
      'SELECT * FROM gigs WHERE id = $1 AND company_id = $2',
      [gigId, req.user.id]
    );

    if (gig.rows.length === 0) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Check for existing escrow
    const existingEscrow = await db.query(
      "SELECT id FROM escrow_transactions WHERE gig_id = $1 AND status = 'locked'",
      [gigId]
    );

    if (existingEscrow.rows.length > 0) {
      return res.status(400).json({ error: 'Escrow already funded for this gig' });
    }

    // Get wallet
    const wallet = await db.query('SELECT * FROM wallets WHERE user_id = $1', [req.user.id]);

    if (parseFloat(amount) > parseFloat(wallet.rows[0].balance)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create escrow transaction
    const result = await db.query(
      `INSERT INTO escrow_transactions (gig_id, company_id, amount, auto_release_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
       RETURNING *`,
      [gigId, req.user.id, amount]
    );

    // Deduct from wallet
    const balanceBefore = parseFloat(wallet.rows[0].balance);
    const balanceAfter = balanceBefore - parseFloat(amount);

    await db.query(
      'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
      [amount, wallet.rows[0].id]
    );

    // Record transaction
    await db.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'escrow_lock', $2, $3, $4, 'escrow', $5, 'Escrow payment locked')`,
      [wallet.rows[0].id, amount, balanceBefore, balanceAfter, result.rows[0].id]
    );

    logger.info(`Escrow funded: ₹${amount} for gig ${gigId}`);
    res.json({ escrow: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.releaseEscrow = async (req, res, next) => {
  try {
    const { gigId } = req.params;

    // Get escrow transaction
    const escrow = await db.query(
      "SELECT * FROM escrow_transactions WHERE gig_id = $1 AND company_id = $2 AND status = 'locked'",
      [gigId, req.user.id]
    );

    if (escrow.rows.length === 0) {
      return res.status(404).json({ error: 'No active escrow found for this gig' });
    }

    const escrowData = escrow.rows[0];

    // Get student wallet
    const studentWallet = await db.query('SELECT * FROM wallets WHERE user_id = $1', [escrowData.student_id]);

    if (studentWallet.rows.length === 0) {
      return res.status(400).json({ error: 'Student wallet not found' });
    }

    // Release to student wallet
    const balanceBefore = parseFloat(studentWallet.rows[0].balance);
    const balanceAfter = balanceBefore + parseFloat(escrowData.amount);

    await db.query(
      'UPDATE wallets SET balance = balance + $1, locked_balance = GREATEST(0, locked_balance - $1) WHERE id = $2',
      [escrowData.amount, studentWallet.rows[0].id]
    );

    // Update escrow status
    await db.query(
      "UPDATE escrow_transactions SET status = 'released', released_at = NOW(), released_to_wallet = true WHERE id = $1",
      [escrowData.id]
    );

    // Record transaction for student
    await db.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'escrow_release', $2, $3, $4, 'escrow', $5, 'Escrow payment released')`,
      [studentWallet.rows[0].id, escrowData.amount, balanceBefore, balanceAfter, escrowData.id]
    );

    // Update student's total earned
    await db.query(
      'UPDATE wallets SET total_earned = total_earned + $1 WHERE user_id = $2',
      [escrowData.amount, escrowData.student_id]
    );

    // Create notification for student
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'payment_received', 'Payment Received', $2, $3)`,
      [escrowData.student_id,
       `You received ₹${escrowData.amount} for completing a gig`,
       JSON.stringify({ gig_id: gigId, amount: escrowData.amount })]
    );

    logger.info(`Escrow released: ₹${escrowData.amount} for gig ${gigId}`);
    res.json({ message: 'Escrow released successfully' });
  } catch (error) {
    next(error);
  }
};
