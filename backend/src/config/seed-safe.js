require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const seedSafe = async () => {
  try {
    await db.query('SELECT 1');
    console.log('🗄️  Connected to database. Safe seeding...\n');

    const getOrCreateUser = async ({ email, password, role, full_name, bio, city, college, skills, trust_score, talent_tier, is_email_verified = true }) => {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        console.log(`⏭️  User ${email} already exists, skipping`);
        const userId = existing.rows[0].id;
        const profile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        return { userId, profileId: profile.rows[0]?.id || null };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      await db.query(
        `INSERT INTO users (id, email, password_hash, role, is_email_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [userId, email, passwordHash, role, is_email_verified]
      );

      const profileId = uuidv4();
      const skillsArray = skills ? skills.split(',') : [];
      const existingProfile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
      if (existingProfile.rows.length > 0) {
        await db.query(
          `UPDATE profiles SET full_name = $1, bio = $2, city = $3, college_name = $4, skills = $5, trust_score = $6, talent_tier = $7
           WHERE user_id = $8 RETURNING id`,
          [full_name, bio || '', city || '', college || '', skillsArray, trust_score || 0, talent_tier || 'new', userId]
        );
        const updated = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        return { userId, profileId: updated.rows[0].id };
      } else {
        await db.query(
          `INSERT INTO profiles (id, user_id, full_name, bio, city, college_name, skills, trust_score, talent_tier)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [profileId, userId, full_name, bio || '', city || '', college || '', skillsArray, trust_score || 0, talent_tier || 'new']
        );
        return { userId, profileId };
      }
    };

    // 1. Admin
    const adminResult = await getOrCreateUser({
      email: 'admin@nextgencampus.com', password: 'admin123', role: 'admin',
      full_name: 'Platform Admin', bio: 'NextGen Campus administrator',
      city: 'Mumbai', college: 'TCSC', trust_score: 100, talent_tier: 'featured'
    });
    const adminId = adminResult.userId;
    console.log('✅ Admin: admin@nextgencampus.com / admin123');

    // 2. Students
    const students = [
      { email: 'sujal@student.com', password: 'password123', full_name: 'Sujal Borhade', bio: 'B.Sc CS student at TCSC, passionate about web dev and AI', city: 'Mumbai', college: 'Thakur College of Science and Commerce', skills: 'React,Node.js,Python,Tailwind CSS', trust_score: 55, talent_tier: 'rising' },
      { email: 'priya@student.com', password: 'password123', full_name: 'Priya Sharma', bio: 'CS student from Pune, learning full-stack development', city: 'Pune', college: 'Fergusson College', skills: 'JavaScript,React,MongoDB,Express.js', trust_score: 32, talent_tier: 'rising' },
      { email: 'rahul@student.com', password: 'password123', full_name: 'Rahul Verma', bio: 'Aspiring data scientist from Jaipur', city: 'Jaipur', college: 'Rajasthan University', skills: 'Python,Machine Learning,Pandas,NumPy', trust_score: 10, talent_tier: 'new' },
      { email: 'ananya@student.com', password: 'password123', full_name: 'Ananya Patel', bio: 'UI/UX design enthusiast from Ahmedabad', city: 'Ahmedabad', college: 'Gujarat University', skills: 'Figma,UI/UX Design,HTML,CSS', trust_score: 0, talent_tier: 'new' }
    ];

    const studentIds = [];
    for (const s of students) {
      const result = await getOrCreateUser({ ...s, role: 'student' });
      studentIds.push(result.userId);
    }
    console.log(`✅ Students seeded\n`);

    // 3. Alumni / Mentors
    const alumni = [
      { email: 'mentor1@alumni.com', password: 'password123', full_name: 'Vikram Mehta', bio: 'Senior SDE at Google, 8 years experience. B.Sc CS from TCSC 2015.', city: 'Bangalore', college: 'Thakur College of Science and Commerce', skills: 'Java,System Design,DSA,AWS', trust_score: 85, talent_tier: 'featured', company_name: 'Google', designation: 'Senior Software Engineer', years_of_experience: 8 },
      { email: 'mentor2@alumni.com', password: 'password123', full_name: 'Neha Kulkarni', bio: 'ML Engineer at Microsoft, IIT Bombay alumna. Passionate about AI.', city: 'Hyderabad', college: 'IIT Bombay', skills: 'Python,Machine Learning,TensorFlow,Deep Learning', trust_score: 90, talent_tier: 'featured', company_name: 'Microsoft', designation: 'ML Engineer', years_of_experience: 6 },
      { email: 'mentor3@alumni.com', password: 'password123', full_name: 'Arjun Singh', bio: 'Freelance full-stack dev. Built 20+ projects for startups.', city: 'Delhi', college: 'Delhi University', skills: 'React,Node.js,PostgreSQL,Docker', trust_score: 72, talent_tier: 'featured', designation: 'Freelance Developer', years_of_experience: 5 }
    ];

    const alumniIds = [];
    for (const a of alumni) {
      const result = await getOrCreateUser({ ...a, role: 'alumni' });
      alumniIds.push(result.userId);
      if (result.profileId) {
        await db.query(
          `INSERT INTO alumni_profiles (id, user_id, profile_id, graduation_year, current_company, current_designation, years_of_experience, mentoring_available, mentorship_areas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
           ON CONFLICT (user_id) DO NOTHING`,
          [uuidv4(), result.userId, result.profileId, 2015, a.company_name || 'Tech Company', a.designation || 'Software Engineer', a.years_of_experience || 5, a.skills.split(',').slice(0, 3)]
        );
      }
    }
    console.log(`✅ Mentors seeded\n`);

    // 4. Companies
    const companies = [
      { email: 'hr@techstartup.com', password: 'password123', full_name: 'TechStartup India', bio: 'Early-stage startup building the future of ed-tech', city: 'Mumbai', college: 'N/A', skills: 'N/A', trust_score: 60, talent_tier: 'rising', company_name: 'TechStartup India' },
      { email: 'talent@codecraft.com', password: 'password123', full_name: 'CodeCraft Solutions', bio: 'Custom software development agency. We hire top student talent.', city: 'Pune', college: 'N/A', skills: 'N/A', trust_score: 45, talent_tier: 'rising', company_name: 'CodeCraft Solutions' }
    ];

    for (const c of companies) {
      const result = await getOrCreateUser({ ...c, role: 'company' });
      await db.query(
        `INSERT INTO company_profiles (user_id, company_name, industry, is_verified, trust_score)
         VALUES ($1, $2, 'Technology', true, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [result.userId, c.company_name, c.trust_score || 50]
      );
    }
    console.log(`✅ Companies seeded\n`);

    // 5. Doubts
    const doubts = [
      { title: 'How does virtual memory work in OS?', content: 'I understand physical memory and paging, but I am confused about how the OS manages virtual memory when physical RAM is full. Can someone explain the swap mechanism?', tags: 'os,memory-management,paging', subject: 'Operating Systems', user_id: studentIds[0], upvotes: 5, status: 'answered' },
      { title: 'Difference between SQL joins?', content: 'Can someone explain INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN with simple examples?', tags: 'sql,databases,joins', subject: 'Database Management', user_id: studentIds[1], upvotes: 8, status: 'answered' },
      { title: 'How to start with React project structure?', content: 'I just learned React basics. What is the best folder structure for a medium-sized project? Should I use Redux or Context API for state management?', tags: 'react,frontend,project-structure', subject: 'Web Development', user_id: studentIds[2], upvotes: 3, status: 'open' }
    ];

    const doubtIds = [];
    for (const d of doubts) {
      const existing = await db.query('SELECT id FROM doubts WHERE title = $1', [d.title]);
      if (existing.rows.length > 0) {
        doubtIds.push(existing.rows[0].id);
        console.log(`⏭️  Doubt "${d.title}" already exists`);
        continue;
      }
      const doubtId = uuidv4();
      await db.query(
        `INSERT INTO doubts (id, author_id, title, content, tags, subject, upvotes, status)
         VALUES ($1, $2, $3, $4, string_to_array($5, ','), $6, $7, $8)`,
        [doubtId, d.user_id, d.title, d.content, d.tags, d.subject, d.upvotes, d.status]
      );
      doubtIds.push(doubtId);
    }
    console.log(`✅ Doubts seeded\n`);

    // 6. Answers
    if (doubtIds.length >= 2) {
      const existingAnswers = await db.query('SELECT id FROM doubt_answers LIMIT 1');
      if (existingAnswers.rows.length === 0) {
        const answersData = [
          { doubt_id: doubtIds[0], user_id: alumniIds[0], content: 'Virtual memory is an abstraction that gives each process the illusion of a contiguous address space. When a process accesses a page not in RAM (page fault), the OS finds the page on disk (swap), loads it into a free frame, and updates the page table. If no free frame is available, it evicts a page using an algorithm like LRU. The TLB (Translation Lookaside Buffer) caches recent page table entries to speed up address translation.', upvotes: 12, is_accepted: true },
          { doubt_id: doubtIds[1], user_id: alumniIds[1], content: 'INNER JOIN returns only rows with matching values in both tables. LEFT JOIN returns all rows from the left table and matching rows from the right (NULL if no match). RIGHT JOIN is the opposite. FULL OUTER JOIN returns all rows from both tables, with NULLs where there is no match.', upvotes: 15, is_accepted: true }
        ];
        for (const a of answersData) {
          await db.query(
            `INSERT INTO doubt_answers (id, doubt_id, author_id, content, upvotes, is_accepted)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuidv4(), a.doubt_id, a.user_id, a.content, a.upvotes, a.is_accepted]
          );
        }
        console.log('✅ Doubt answers seeded');
      } else {
        console.log('⏭️  Answers already exist');
      }
    }

    // 7. Gigs
    const gigs = [
      { title: 'React Frontend for E-commerce App', description: 'Build a responsive React frontend for a small e-commerce site.', category: 'Web Development', compensation: 8000, duration_days: 14, skills_required: 'React,Tailwind CSS,REST APIs', company_email: 'hr@techstartup.com', status: 'open', max_students: 2 },
      { title: 'Python Script for Data Cleaning', description: 'Write a Python script to clean and preprocess a 50K row CSV dataset.', category: 'Data Science', compensation: 3000, duration_days: 7, skills_required: 'Python,Pandas,NumPy', company_email: 'talent@codecraft.com', status: 'open', max_students: 1 },
      { title: 'Logo and Brand Identity Design', description: 'Design a logo and basic brand identity for a new ed-tech startup.', category: 'Graphic Design', compensation: 5000, duration_days: 10, skills_required: 'Figma,Adobe Illustrator,Graphic Design', company_email: 'hr@techstartup.com', status: 'open', max_students: 1 }
    ];

    const gigIds = [];
    for (const g of gigs) {
      const existing = await db.query('SELECT id FROM gigs WHERE title = $1', [g.title]);
      if (existing.rows.length > 0) {
        gigIds.push(existing.rows[0].id);
        console.log(`⏭️  Gig "${g.title}" already exists`);
        continue;
      }
      const result = await db.query('SELECT id FROM users WHERE email = $1', [g.company_email]);
      if (result.rows.length === 0) continue;
      const companyId = result.rows[0].id;
      const gigId = uuidv4();
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      await db.query(
        `INSERT INTO gigs (id, company_id, title, description, category, skills_required, compensation, duration_days, max_students, status, application_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [gigId, companyId, g.title, g.description, g.category, g.skills_required.split(','), g.compensation, g.duration_days, g.max_students || 1, g.status, deadline.toISOString()]
      );
      gigIds.push(gigId);
    }
    console.log(`✅ Gigs seeded\n`);

    // 8. Resources
    const resources = [
      { title: 'DSA Cheat Sheet', description: 'Essential data structures and algorithms with time complexities', resource_type: 'document', subject: 'programming', difficulty_level: 'intermediate', file_url: '/files/dsa-cheatsheet.pdf' },
      { title: 'SQL Joins Visual Guide', description: 'Visual explanation of all SQL join types with examples', resource_type: 'document', subject: 'databases', difficulty_level: 'beginner', file_url: '/files/sql-joins.pdf' },
      { title: 'OS Interview Questions', description: 'Top 50 operating systems interview questions and answers', resource_type: 'document', subject: 'operating-systems', difficulty_level: 'intermediate', file_url: '/files/os-interview.pdf' },
      { title: 'React Crash Course', description: 'FreeCodeCamp React tutorial for beginners', resource_type: 'video', subject: 'webdev', difficulty_level: 'beginner', file_url: 'https://youtube.com/watch?v=example' }
    ];

    for (const r of resources) {
      const existing = await db.query('SELECT id FROM resources WHERE title = $1', [r.title]);
      if (existing.rows.length > 0) continue;
      await db.query(
        `INSERT INTO resources (id, title, description, resource_type, subject, difficulty_level, file_url, uploader_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), r.title, r.description, r.resource_type, r.subject, r.difficulty_level, r.file_url, adminId]
      );
    }
    console.log('✅ Resources seeded');

    // 9. Mentorship Requests
    const existingRequests = await db.query('SELECT id FROM mentorship_requests LIMIT 1');
    if (existingRequests.rows.length === 0) {
      const request1Id = uuidv4();
      const request2Id = uuidv4();
      await db.query(
        `INSERT INTO mentorship_requests (id, student_id, mentor_id, message, status, student_goals, preferred_session_type)
         VALUES ($1, $2, $3, $4, 'accepted', $5, 'video')`,
        [request1Id, studentIds[0], alumniIds[0], 'I need guidance for DSA placements at product companies.', 'Master DSA and system design for placement prep']
      );
      await db.query(
        `INSERT INTO mentorship_requests (id, student_id, mentor_id, message, status, student_goals, preferred_session_type)
         VALUES ($1, $2, $3, $4, 'pending', $5, 'chat')`,
        [request2Id, studentIds[1], alumniIds[0], 'I want to learn full-stack development best practices.', 'Learn React + Node.js production patterns']
      );
      console.log('✅ Mentorship requests seeded (1 accepted, 1 pending)');
    } else {
      console.log('⏭️  Mentorship requests already exist');
    }

    // 10. Mentorship Sessions
    const existingSessions = await db.query('SELECT id FROM mentorship_sessions LIMIT 1');
    if (existingSessions.rows.length === 0) {
      const acceptedRequest = await db.query("SELECT id, student_id, mentor_id FROM mentorship_requests WHERE status = 'accepted' LIMIT 1");
      if (acceptedRequest.rows.length > 0) {
        const req = acceptedRequest.rows[0];
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 3);
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 5);

        await db.query(
          `INSERT INTO mentorship_sessions (request_id, student_id, mentor_id, session_type, status, scheduled_at, notes)
           VALUES ($1, $2, $3, 'video', 'scheduled', $4, 'Let''s discuss binary trees and graph algorithms')`,
          [req.id, req.student_id, req.mentor_id, scheduledDate.toISOString()]
        );
        await db.query(
          `INSERT INTO mentorship_sessions (request_id, student_id, mentor_id, session_type, status, scheduled_at, notes)
           VALUES ($1, $2, $3, 'video', 'completed', $4, 'Covered basic DSA sorting and recursion')`,
          [req.id, req.student_id, req.mentor_id, pastDate.toISOString()]
        );
        console.log('✅ Mentorship sessions seeded (1 upcoming, 1 completed)');
      }
    } else {
      console.log('⏭️  Mentorship sessions already exist');
    }

    // 11. Chat Conversations & Messages
    const existingConvos = await db.query('SELECT id FROM conversations LIMIT 1');
    if (existingConvos.rows.length === 0) {
      const convoId = uuidv4();
      await db.query(
        `INSERT INTO conversations (id, type, title, is_active)
         VALUES ($1, 'mentorship', NULL, true)`,
        [convoId]
      );
      await db.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [convoId, studentIds[0], alumniIds[0]]
      );
      const messages = [
        { sender: studentIds[0], content: 'Hi Vikram! I have a question about binary search trees.' },
        { sender: alumniIds[0], content: 'Hey Sujal! Sure, what do you want to know?' },
        { sender: studentIds[0], content: 'How do I balance a BST after inserting a new node?' },
        { sender: alumniIds[0], content: 'Great question! You can use AVL or Red-Black tree rotations. Let me walk you through it in our next session.' }
      ];
      for (let i = 0; i < messages.length; i++) {
        await db.query(
          `INSERT INTO messages (conversation_id, sender_id, content, read_by)
           VALUES ($1, $2, $3, $4)`,
          [convoId, messages[i].sender, messages[i].content, [messages[i].sender]]
        );
      }
      console.log('✅ Chat conversation with 4 messages seeded');
    } else {
      console.log('⏭️  Conversations already exist');
    }

    // Count users
    const userCount = await db.query('SELECT role, COUNT(*) FROM users GROUP BY role');
    console.log('\n📊 Users by role:');
    for (const row of userCount.rows) {
      console.log(`   ${row.role}: ${row.count}`);
    }

    console.log('\n🎉 Safe seed completed!');
    console.log('\n📋 Test accounts:');
    console.log('   Admin:    admin@nextgencampus.com / admin123');
    console.log('   Student:  sujal@student.com / password123');
    console.log('   Student:  priya@student.com / password123');
    console.log('   Mentor:   mentor1@alumni.com / password123');
    console.log('   Company:  hr@techstartup.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedSafe();
