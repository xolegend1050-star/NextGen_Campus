const db = require('../../config/database');
const logger = require('../../utils/logger');
const { sendVerificationApprovedEmail, sendVerificationRejectedEmail } = require('../../utils/email');
const { awardPoints } = require('../../utils/trustTiers');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalAlumni,
      totalCompanies,
      totalDoubts,
      totalAnswers,
      totalGigs,
      totalApplications,
      totalSessions,
      pendingVerifications,
      flaggedContent,
      openDisputes,
      totalWalletBalance,
      recentActivity
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = true"),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'alumni' AND is_active = true"),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'company' AND is_active = true"),
      db.query('SELECT COUNT(*) FROM doubts'),
      db.query('SELECT COUNT(*) FROM doubt_answers'),
      db.query('SELECT COUNT(*) FROM gigs'),
      db.query('SELECT COUNT(*) FROM gig_applications'),
      db.query("SELECT COUNT(*) FROM mentorship_sessions WHERE status = 'completed'"),
      db.query("SELECT COUNT(*) FROM verifications WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) FROM flagged_content WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) FROM disputes WHERE status = 'open'"),
      db.query('SELECT SUM(balance) as total FROM wallets'),
      db.query(`
        SELECT 'doubt' as type, created_at FROM doubts
        UNION ALL
        SELECT 'application' as type, created_at FROM gig_applications
        UNION ALL
        SELECT 'session' as type, created_at FROM mentorship_sessions
        ORDER BY created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      stats: {
        users: {
          total: parseInt(totalUsers.rows[0].count),
          students: parseInt(totalStudents.rows[0].count),
          alumni: parseInt(totalAlumni.rows[0].count),
          companies: parseInt(totalCompanies.rows[0].count)
        },
        content: {
          doubts: parseInt(totalDoubts.rows[0].count),
          answers: parseInt(totalAnswers.rows[0].count),
          gigs: parseInt(totalGigs.rows[0].count),
          applications: parseInt(totalApplications.rows[0].count),
          sessions: parseInt(totalSessions.rows[0].count)
        },
        pending: {
          verifications: parseInt(pendingVerifications.rows[0].count),
          flaggedContent: parseInt(flaggedContent.rows[0].count),
          disputes: parseInt(openDisputes.rows[0].count)
        },
        wallet: {
          totalBalance: parseFloat(totalWalletBalance.rows[0].total || 0)
        },
        recentActivity: recentActivity.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT u.id, u.email, u.role, u.is_active, u.is_banned, u.created_at,
                        p.full_name, p.avatar_url, p.trust_score, p.talent_tier
                 FROM users u
                 LEFT JOIN profiles p ON u.id = p.user_id`;
    let countQuery = `SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON u.id = p.user_id`;
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }
    if (search) {
      conditions.push(`(u.email ILIKE $${params.length + 1} OR p.full_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause.replace(/u\./g, '').replace(/p\./g, '');
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [users, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      users: users.rows,
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

exports.banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }
    await db.query('UPDATE users SET is_banned = true WHERE id = $1', [id]);
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id) VALUES ($1, 'ban_user', $2)`,
      [req.user.id, id]
    );
    logger.info(`User banned: ${id}`);
    res.json({ message: 'User banned' });
  } catch (error) {
    next(error);
  }
};

exports.unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE users SET is_banned = false WHERE id = $1', [id]);
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id) VALUES ($1, 'unban_user', $2)`,
      [req.user.id, id]
    );
    logger.info(`User unbanned: ${id}`);
    res.json({ message: 'User unbanned' });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['student', 'alumni', 'company', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, reason) VALUES ($1, 'change_role', $2, $3)`,
      [req.user.id, id, `Changed role to ${role}`]
    );
    logger.info(`User role updated: ${id} -> ${role}`);
    res.json({ message: 'Role updated' });
  } catch (error) {
    next(error);
  }
};

exports.getPendingVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const offset = (page - 1) * limit;
    const statusFilter = status && status !== 'all' ? status : 'pending';

    let whereClause = 'WHERE v.status = $1';
    const params = [statusFilter];

    if (type && type !== 'all') {
      params.push(type);
      whereClause += ` AND v.verification_type = $${params.length}`;
    }

    const result = await db.query(
      `SELECT v.*,
              u.email, u.role,
              p.full_name, p.avatar_url
       FROM verifications v
       JOIN users u ON v.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       ${whereClause}
       ORDER BY v.created_at ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const count = await db.query(
      `SELECT COUNT(*) FROM verifications v ${whereClause}`,
      params
    );

    res.json({
      requests: result.rows,
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

exports.reviewVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const verification = await db.query(
      'SELECT * FROM verifications WHERE id = $1',
      [id]
    );

    if (verification.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Update verification status
    await db.query(
      `UPDATE verifications 
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
       WHERE id = $4`,
      [status, req.user.id, rejection_reason || null, id]
    );

    // If approved, update user verification status and award badge
    if (status === 'approved') {
      await db.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [verification.rows[0].user_id]
      );

      // Badge auto-award based on verification type
      const vType = verification.rows[0].verification_type;
      const userId = verification.rows[0].user_id;
      let badgeName = null;
      if (vType === 'student_college_email' || vType === 'student_id_card') badgeName = 'Verified Student';
      else if (vType === 'alumni_linkedin' || vType === 'alumni_college_id') badgeName = 'Verified Alumni';
      else if (vType === 'company_domain' || vType === 'company_gst') badgeName = 'Verified Company';

      if (badgeName) {
        const badge = await db.query('SELECT id FROM badges WHERE name = $1', [badgeName]);
        if (badge.rows.length > 0) {
          await db.query(
            `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, badge.rows[0].id]
          );
        }
      }

      // Award trust score points via centralized system
      await awardPoints(userId, 'verification_approved', vType, id);
    }

    // Log admin action
    const auditAction = status === 'approved' ? 'approve_verification' : 'reject_verification';
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, reason, target_resource_type, target_resource_id)
       VALUES ($1, $2, $3, $4, 'verification', $5)`,
      [req.user.id, auditAction, verification.rows[0].user_id, rejection_reason || 'Verification reviewed', id]
    );

    // Create notification for user
    const notificationMessage = status === 'approved'
      ? 'Your verification has been approved!'
      : `Your verification has been rejected. Reason: ${rejection_reason}`;

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'verification_approved', 'Verification Update', $2, $3)`,
      [verification.rows[0].user_id, notificationMessage, JSON.stringify({ verification_id: id, status })]
    );

    // Send email notification (non-blocking)
    const vUser = await db.query('SELECT email FROM users WHERE id = $1', [verification.rows[0].user_id]);
    const userEmail = vUser.rows[0]?.email;
    if (userEmail) {
      const emailFn = status === 'approved' ? sendVerificationApprovedEmail : sendVerificationRejectedEmail;
      emailFn(userEmail, verification.rows[0].verification_type, null, rejection_reason).catch(() => {});
    }

    logger.info(`Verification ${status}: ${id}`);
    res.json({ message: `Verification ${status}` });
  } catch (error) {
    next(error);
  }
};

exports.getFlaggedContent = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT fc.*,
              u.email as reporter_email,
              p.full_name as reporter_name
       FROM flagged_content fc
       JOIN users u ON fc.reported_by = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE fc.status = 'pending'
       ORDER BY fc.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const count = await db.query(
      "SELECT COUNT(*) FROM flagged_content WHERE status = 'pending'"
    );

    res.json({
      flagged: result.rows,
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

exports.reviewFlaggedContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    const flagged = await db.query(
      'SELECT * FROM flagged_content WHERE id = $1',
      [id]
    );

    if (flagged.rows.length === 0) {
      return res.status(404).json({ error: 'Flagged content not found' });
    }

    // Update status
    await db.query(
      `UPDATE flagged_content 
       SET status = 'reviewed', reviewed_by = $1, action_taken = $2
       WHERE id = $3`,
      [req.user.id, action, id]
    );

    // If ban action, ban the CONTENT AUTHOR (not the reporter)
    if (action === 'ban') {
      // Look up the content author based on content type
      let authorId = null;
      switch (flagged.rows[0].content_type) {
        case 'company': {
          const author = await db.query('SELECT user_id FROM company_profiles WHERE user_id = $1', [flagged.rows[0].content_id]);
          authorId = author.rows[0]?.user_id;
          break;
        }
        case 'doubt': {
          const author = await db.query('SELECT author_id FROM doubts WHERE id = $1', [flagged.rows[0].content_id]);
          authorId = author.rows[0]?.author_id;
          break;
        }
        case 'answer': {
          const author = await db.query('SELECT author_id FROM doubt_answers WHERE id = $1', [flagged.rows[0].content_id]);
          authorId = author.rows[0]?.author_id;
          break;
        }
        case 'mentor': {
          const author = await db.query('SELECT mentor_id FROM mentorship_requests WHERE id = $1', [flagged.rows[0].content_id]);
          authorId = author.rows[0]?.mentor_id;
          break;
        }
        default:
          break;
      }
      if (authorId) {
        await db.query(
          'UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2',
          [reason, authorId]
        );
      }
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, reason, target_resource_type, target_resource_id)
       VALUES ($1, 'flag_content', $2, $3, $4, $5)`,
      [req.user.id, authorId || flagged.rows[0].reported_by, reason, flagged.rows[0].content_type, flagged.rows[0].content_id]
    );

    logger.info(`Flagged content reviewed: ${id}, action: ${action}`);
    res.json({ message: 'Flagged content reviewed' });
  } catch (error) {
    next(error);
  }
};

exports.getDisputes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT d.*,
              g.title as gig_title, g.compensation,
              raiser.full_name as raiser_name, raiser.email as raiser_email,
              against.full_name as against_name, against.email as against_email
       FROM disputes d
       JOIN gigs g ON d.gig_id = g.id
       JOIN users ru ON d.raised_by = ru.id
       JOIN profiles raiser ON ru.id = raiser.user_id
       JOIN users au ON d.against_id = au.id
       JOIN profiles against ON au.id = against.user_id
       WHERE d.status = 'open'
       ORDER BY d.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const count = await db.query(
      "SELECT COUNT(*) FROM disputes WHERE status = 'open'"
    );

    res.json({
      disputes: result.rows,
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

exports.resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution, release_to_student } = req.body;

    const dispute = await db.query(
      'SELECT * FROM disputes WHERE id = $1',
      [id]
    );

    if (dispute.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Update dispute
    await db.query(
      `UPDATE disputes 
       SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3`,
      [resolution, req.user.id, id]
    );

    // Release escrow if needed
    if (release_to_student && dispute.rows[0].escrow_id) {
      const escrow = await db.query(
        'SELECT * FROM escrow_transactions WHERE id = $1',
        [dispute.rows[0].escrow_id]
      );

      if (escrow.rows.length > 0) {
        // Release to student wallet
        const studentWallet = await db.query(
          'SELECT * FROM wallets WHERE user_id = $1',
          [escrow.rows[0].student_id]
        );

        if (studentWallet.rows.length > 0) {
          await db.query(
            'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
            [escrow.rows[0].amount, studentWallet.rows[0].id]
          );

          await db.query(
            "UPDATE escrow_transactions SET status = 'released', released_at = NOW() WHERE id = $1",
            [escrow.rows[0].id]
          );

          await db.query(
            `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'escrow_release', $2, $3, $4, 'dispute', $5, 'Escrow released after dispute resolution')`,
            [
              studentWallet.rows[0].id,
              escrow.rows[0].amount,
              studentWallet.rows[0].balance,
              parseFloat(studentWallet.rows[0].balance) + escrow.rows[0].amount,
              id
            ]
          );
        }
      }
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, reason, target_resource_type, target_resource_id)
       VALUES ($1, 'resolve_dispute', $2, $3, 'dispute', $4)`,
      [req.user.id, dispute.rows[0].raised_by, resolution, id]
    );

    // Notify both parties
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'dispute_resolved', 'Dispute Resolved', $2, $3)`,
      [dispute.rows[0].raised_by, `Your dispute has been resolved: ${resolution}`, JSON.stringify({ dispute_id: id })]
    );
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'dispute_resolved', 'Dispute Resolved', $2, $3)`,
      [dispute.rows[0].against_id, `A dispute against you has been resolved: ${resolution}`, JSON.stringify({ dispute_id: id })]
    );

    logger.info(`Dispute resolved: ${id}`);
    res.json({ message: 'Dispute resolved' });
  } catch (error) {
    next(error);
  }
};

exports.getAuditLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, admin_id, action_type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT aal.*,
             u.email as admin_email,
             p.full_name as admin_name
      FROM admin_audit_log aal
      JOIN users u ON aal.admin_id = u.id
      JOIN profiles p ON u.id = p.user_id
    `;
    let countQuery = 'SELECT COUNT(*) FROM admin_audit_log';
    const params = [];
    const conditions = [];

    if (admin_id) {
      conditions.push(`aal.admin_id = $${params.length + 1}`);
      params.push(admin_id);
    }

    if (action_type) {
      conditions.push(`aal.action_type = $${params.length + 1}`);
      params.push(action_type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY aal.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [result, count] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      logs: result.rows,
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
