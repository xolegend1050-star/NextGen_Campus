const logger = require('./logger');

const VALID_TRANSITIONS = {
  pending: ['approved', 'rejected', 'expired'],
  rejected: ['pending'],
  expired: ['pending'],
  approved: ['expired']
};

const canTransition = (from, to) => {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
};

const transitionVerification = async (db, verificationId, newStatus, reviewedBy = null, reason = null) => {
  const result = await db.query(
    'SELECT * FROM verifications WHERE id = $1',
    [verificationId]
  );

  if (result.rows.length === 0) {
    throw new Error('Verification not found');
  }

  const current = result.rows[0];

  if (!canTransition(current.status, newStatus)) {
    throw new Error(`Invalid transition: ${current.status} → ${newStatus}`);
  }

  const updates = {
    status: newStatus,
    reviewed_at: new Date()
  };

  if (reviewedBy) updates.reviewed_by = reviewedBy;
  if (reason) updates.rejection_reason = reason;

  await db.query(
    `UPDATE verifications
     SET status = $1, reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
     WHERE id = $4`,
    [newStatus, reviewedBy, reason, verificationId]
  );

  logger.info(`Verification ${verificationId}: ${current.status} → ${newStatus}`);
  return { ...current, ...updates };
};

module.exports = { canTransition, transitionVerification, VALID_TRANSITIONS };
