require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const seedAdminData = async () => {
  try {
    await db.query('SELECT 1');
    console.log('🗄️  Seeding admin panel data...\n');

    // Get existing users
    const users = await db.query("SELECT id, email, role FROM users ORDER BY created_at");
    const userMap = {};
    for (const u of users.rows) {
      userMap[u.email] = u;
    }
    const adminId = userMap['admin@nextgencampus.com']?.id;
    const student1 = userMap['sujal@student.com']?.id;
    const student2 = userMap['priya@student.com']?.id;
    const student3 = userMap['rahul@student.com']?.id;
    const alumni1 = userMap['mentor1@alumni.com']?.id;
    const alumni2 = userMap['mentor2@alumni.com']?.id;
    const company1 = userMap['hr@techstartup.com']?.id;

    if (!adminId) { console.error('❌ Admin user not found'); process.exit(1); }

    // 1. Wallets
    const existingWallets = await db.query('SELECT id FROM wallets LIMIT 1');
    if (existingWallets.rows.length === 0) {
      const walletUsers = [student1, student2, student3, alumni1, alumni2, company1].filter(Boolean);
      for (const uid of walletUsers) {
        const balance = Math.floor(Math.random() * 5000) + 500;
        await db.query(
          'INSERT INTO wallets (id, user_id, balance) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [uuidv4(), uid, balance]
        );
      }
      console.log('✅ Wallets created for 6 users');
    } else {
      console.log('⏭️  Wallets already exist');
    }

    // 2. Verification Requests
    const existingVerifs = await db.query('SELECT id FROM verifications LIMIT 1');
    if (existingVerifs.rows.length === 0) {
      const verifications = [
        { user_id: student1, type: 'student_college_email', tier: 'tier1_auto', status: 'pending', doc_url: '/docs/sujal-id.pdf', doc_type: 'application/pdf' },
        { user_id: student2, type: 'student_id_card', tier: 'tier2_manual', status: 'pending', doc_url: '/docs/priya-id.jpg', doc_type: 'image/jpeg' },
        { user_id: student3, type: 'student_college_email', tier: 'tier1_auto', status: 'pending', doc_url: '/docs/rahul-email.png', doc_type: 'image/png' },
        { user_id: alumni1, type: 'alumni_linkedin', tier: 'tier1_auto', status: 'approved', reviewed_by: adminId, doc_url: '/docs/vikram-linkedin.pdf', doc_type: 'application/pdf' },
        { user_id: alumni2, type: 'alumni_college_id', tier: 'tier2_manual', status: 'rejected', reviewed_by: adminId, rejection_reason: 'Document is blurry, please rescan.', doc_url: '/docs/neha-id.pdf', doc_type: 'application/pdf' },
      ];
      for (const v of verifications) {
        await db.query(
          `INSERT INTO verifications (id, user_id, verification_type, tier, status, document_url, document_type, reviewed_by, rejection_reason, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uuidv4(), v.user_id, v.type, v.tier, v.status, v.doc_url, v.doc_type,
           v.reviewed_by || null, v.rejection_reason || null,
           v.status !== 'pending' ? new Date() : null]
        );
      }
      console.log('✅ 5 verification requests seeded (3 pending, 1 approved, 1 rejected)');
    } else {
      console.log('⏭️  Verifications already exist');
    }

    // 3. Flagged Content
    const existingFlags = await db.query('SELECT id FROM flagged_content LIMIT 1');
    if (existingFlags.rows.length === 0) {
      // Get a doubt ID and an answer ID to flag
      const doubts = await db.query('SELECT id FROM doubts LIMIT 2');
      const answers = await db.query('SELECT id FROM doubt_answers LIMIT 1');

      const flags = [];
      if (doubts.rows.length > 0) {
        flags.push({
          content_type: 'doubt', content_id: doubts.rows[0].id,
          reported_by: student2, reason: 'Spam / irrelevant content',
          description: 'This doubt is just a test submission with no real question.'
        });
      }
      if (doubts.rows.length > 1) {
        flags.push({
          content_type: 'doubt', content_id: doubts.rows[1].id,
          reported_by: student3, reason: 'Inappropriate language',
          description: 'The content contains inappropriate or offensive language.'
        });
      }
      if (answers.rows.length > 0) {
        flags.push({
          content_type: 'answer', content_id: answers.rows[0].id,
          reported_by: student1, reason: 'Incorrect / misleading information',
          description: 'This answer contains factually incorrect information that could mislead students.'
        });
      }

      for (const f of flags) {
        await db.query(
          `INSERT INTO flagged_content (id, content_type, content_id, reported_by, reason, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), f.content_type, f.content_id, f.reported_by, f.reason, f.description]
        );
      }
      console.log(`✅ ${flags.length} flagged content items seeded`);
    } else {
      console.log('⏭️  Flagged content already exists');
    }

    // 4. Disputes
    const existingDisputes = await db.query('SELECT id FROM disputes LIMIT 1');
    if (existingDisputes.rows.length === 0) {
      const gigs = await db.query('SELECT id FROM gigs LIMIT 2');
      if (gigs.rows.length > 0) {
        // Open dispute
        await db.query(
          `INSERT INTO disputes (id, gig_id, raised_by, against_id, reason, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
          [uuidv4(), gigs.rows[0].id, student1, company1,
           'Payment not released after gig completion',
           'I completed the React frontend project 2 weeks ago but have not received the promised ₹8,000 compensation. The company is not responding to messages.']
        );
        console.log('✅ 1 open dispute seeded');
      }
      if (gigs.rows.length > 1) {
        // Resolved dispute
        await db.query(
          `INSERT INTO disputes (id, gig_id, raised_by, against_id, reason, description, status, resolution, resolved_by, resolved_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'resolved', 'Refunded to student - work was incomplete', $7, NOW())`,
          [uuidv4(), gigs.rows[1].id, student2, company1,
           'Deliverables not as described',
           'The data cleaning script was incomplete and did not handle null values as specified in the requirements.',
           adminId]
        );
        console.log('✅ 1 resolved dispute seeded');
      }
    } else {
      console.log('⏭️  Disputes already exist');
    }

    // 5. Admin Audit Log
    const existingLogs = await db.query('SELECT id FROM admin_audit_log LIMIT 1');
    if (existingLogs.rows.length === 0) {
      const logEntries = [
        { action: 'approve_verification', target: alumni1, resource_type: 'verification', reason: 'LinkedIn profile verified, alumni status confirmed.' },
        { action: 'reject_verification', target: alumni2, resource_type: 'verification', reason: 'Document was blurry, requested rescan.' },
        { action: 'ban_user', target: null, resource_type: 'user', reason: 'Automated spam detection triggered.' },
        { action: 'unflag_content', target: student1, resource_type: 'doubt', reason: 'Reviewed flagged content - no violation found.' },
        { action: 'resolve_dispute', target: student2, resource_type: 'dispute', reason: 'Refunded student after reviewing incomplete deliverables.' },
        { action: 'update_trust_score', target: student1, resource_type: 'profile', reason: 'Trust score increased after successful mentorship session completion.' },
      ];
      for (const log of logEntries) {
        await db.query(
          `INSERT INTO admin_audit_log (id, admin_id, action_type, target_user_id, target_resource_type, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), adminId, log.action, log.target, log.resource_type, log.reason]
        );
      }
      console.log(`✅ ${logEntries.length} audit log entries seeded`);
    } else {
      console.log('⏭️  Audit log already has entries');
    }

    console.log('\n🎉 Admin panel data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedAdminData();
