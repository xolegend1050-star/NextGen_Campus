require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const seed = async () => {
  try {
    await db.query('SELECT 1');
    console.log('🗄️  Connected to database. Seeding data...\n');

    // Clear existing data (order matters for foreign keys)
    const tables = [
      'admin_audit_log', 'notifications', 'messages', 'conversations',
      'conversation_participants', 'trust_score_history', 'user_badges', 'flagged_content', 'disputes',
      'escrow_transactions', 'gig_applications', 'gigs', 'mentorship_sessions',
      'mentorship_requests', 'mentor_availability', 'alumni_profiles',
      'doubt_votes', 'doubt_answers', 'doubts',
      'resources', 'verifications', 'wallet_transactions', 'wallets',
      'profiles', 'users'
    ];

    for (const table of tables) {
      await db.query(`DELETE FROM ${table}`);
    }
    console.log('✅ Cleared existing data');

    // Helper to create a user + profile
    const createUser = async ({ email, password, role, full_name, bio, city, college, skills, trust_score, talent_tier, is_email_verified = true }) => {
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      await db.query(
        `INSERT INTO users (id, email, password_hash, role, is_email_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [userId, email, passwordHash, role, is_email_verified]
      );

      const profileId = uuidv4();
      const skillsArray = skills ? skills.split(',') : [];
      
      // Check if trigger already created a profile
      const existingProfile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
      if (existingProfile.rows.length > 0) {
        // Update the auto-created profile
        await db.query(
          `UPDATE profiles SET full_name = $1, bio = $2, city = $3, college_name = $4, skills = $5, trust_score = $6, talent_tier = $7
           WHERE user_id = $8 RETURNING id`,
          [full_name, bio || '', city || '', college || '', skillsArray, trust_score || 0, talent_tier || 'new', userId]
        );
        const updatedProfile = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
        return { userId, profileId: updatedProfile.rows[0].id };
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
    const adminResult = await createUser({
      email: 'admin@nextgencampus.com',
      password: 'admin123',
      role: 'admin',
      full_name: 'Platform Admin',
      bio: 'NextGen Campus administrator',
      city: 'Mumbai',
      college: 'TCSC',
      trust_score: 100,
      talent_tier: 'featured'
    });
    const adminId = adminResult.userId;
    console.log('✅ Created admin user (admin@nextgencampus.com / admin123)');

    // 2. Students
    const students = [
      {
        email: 'sujal@student.com', password: 'password123', full_name: 'Sujal Borhade',
        bio: 'B.Sc CS student at TCSC, passionate about web dev and AI',
        city: 'Mumbai', college: 'Thakur College of Science and Commerce',
        skills: 'React,Node.js,Python,Tailwind CSS', trust_score: 55, talent_tier: 'rising'
      },
      {
        email: 'priya@student.com', password: 'password123', full_name: 'Priya Sharma',
        bio: 'CS student from Pune, learning full-stack development',
        city: 'Pune', college: 'Fergusson College',
        skills: 'JavaScript,React,MongoDB,Express.js', trust_score: 32, talent_tier: 'rising'
      },
      {
        email: 'rahul@student.com', password: 'password123', full_name: 'Rahul Verma',
        bio: 'Aspiring data scientist from Jaipur',
        city: 'Jaipur', college: 'Rajasthan University',
        skills: 'Python,Machine Learning,Pandas,NumPy', trust_score: 10, talent_tier: 'new'
      },
      {
        email: 'ananya@student.com', password: 'password123', full_name: 'Ananya Patel',
        bio: 'UI/UX design enthusiast from Ahmedabad',
        city: 'Ahmedabad', college: 'Gujarat University',
        skills: 'Figma,UI/UX Design,HTML,CSS', trust_score: 0, talent_tier: 'new'
      }
    ];

    const studentIds = [];
    for (const s of students) {
      const result = await createUser({ ...s, role: 'student' });
      studentIds.push(result.userId);
    }
    console.log(`✅ Created ${students.length} students`);

    // 3. Alumni / Mentors
    const alumni = [
      {
        email: 'mentor1@alumni.com', password: 'password123', full_name: 'Vikram Mehta',
        bio: 'Senior SDE at Google, 8 years experience. B.Sc CS from TCSC 2015.',
        city: 'Bangalore', college: 'Thakur College of Science and Commerce',
        skills: 'Java,System Design,DSA,AWS', trust_score: 85, talent_tier: 'featured',
        company_name: 'Google', designation: 'Senior Software Engineer', years_of_experience: 8
      },
      {
        email: 'mentor2@alumni.com', password: 'password123', full_name: 'Neha Kulkarni',
        bio: 'ML Engineer at Microsoft, IIT Bombay alumna. Passionate about AI.',
        city: 'Hyderabad', college: 'IIT Bombay',
        skills: 'Python,Machine Learning,TensorFlow,Deep Learning', trust_score: 90, talent_tier: 'featured',
        company_name: 'Microsoft', designation: 'ML Engineer', years_of_experience: 6
      },
      {
        email: 'mentor3@alumni.com', password: 'password123', full_name: 'Arjun Singh',
        bio: 'Freelance full-stack dev. Built 20+ projects for startups.',
        city: 'Delhi', college: 'Delhi University',
        skills: 'React,Node.js,PostgreSQL,Docker', trust_score: 72, talent_tier: 'featured',
        designation: 'Freelance Developer', years_of_experience: 5
      }
    ];

    const alumniIds = [];
    for (const a of alumni) {
      const result = await createUser({ ...a, role: 'alumni' });
      alumniIds.push(result.userId);
      await db.query(
        `INSERT INTO alumni_profiles (id, user_id, profile_id, graduation_year, current_company, current_designation, years_of_experience, mentoring_available, mentorship_areas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
        [uuidv4(), result.userId, result.profileId, 2015, a.company_name || 'Tech Company', a.designation || 'Software Engineer', a.years_of_experience || 5, a.skills.split(',').slice(0, 3)]
      );
    }
    console.log(`✅ Created ${alumni.length} alumni/mentors with mentor profiles`);

    // 4. Companies
    const companies = [
      {
        email: 'hr@techstartup.com', password: 'password123', full_name: 'TechStartup India',
        bio: 'Early-stage startup building the future of ed-tech',
        city: 'Mumbai', college: 'N/A', skills: 'N/A',
        trust_score: 60, talent_tier: 'rising',
        company_name: 'TechStartup India'
      },
      {
        email: 'talent@codecraft.com', password: 'password123', full_name: 'CodeCraft Solutions',
        bio: 'Custom software development agency. We hire top student talent.',
        city: 'Pune', college: 'N/A', skills: 'N/A',
        trust_score: 45, talent_tier: 'rising',
        company_name: 'CodeCraft Solutions'
      }
    ];

    for (const c of companies) {
      const result = await createUser({ ...c, role: 'company' });
      await db.query(
        `INSERT INTO company_profiles (user_id, company_name, industry, is_verified, trust_score)
         VALUES ($1, $2, 'Technology', true, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [result.userId, c.company_name, c.trust_score || 50]
      );
    }
    console.log(`✅ Created ${companies.length} companies with company profiles`);

    // 5. Doubts
    const doubts = [
      {
        title: 'How does virtual memory work in OS?',
        content: 'I understand physical memory and paging, but I am confused about how the OS manages virtual memory when physical RAM is full. Can someone explain the swap mechanism?',
        tags: 'os,memory-management,paging',
        subject: 'Operating Systems',
        user_id: studentIds[0],
        upvotes: 5, status: 'answered'
      },
      {
        title: 'Difference between SQL joins?',
        content: 'Can someone explain INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN with simple examples? I always get confused between LEFT and RIGHT joins.',
        tags: 'sql,databases,joins',
        subject: 'Database Management',
        user_id: studentIds[1],
        upvotes: 8, status: 'answered'
      },
      {
        title: 'How to start with React project structure?',
        content: 'I just learned React basics. What is the best folder structure for a medium-sized project? Should I use Redux or Context API for state management?',
        tags: 'react,frontend,project-structure',
        subject: 'Web Development',
        user_id: studentIds[2],
        upvotes: 3, status: 'open'
      }
    ];

    const doubtIds = [];
    for (const d of doubts) {
      const doubtId = uuidv4();
      await db.query(
        `INSERT INTO doubts (id, author_id, title, content, tags, subject, upvotes, status)
         VALUES ($1, $2, $3, $4, string_to_array($5, ','), $6, $7, $8)`,
        [doubtId, d.user_id, d.title, d.content, d.tags, d.subject, d.upvotes, d.status]
      );
      doubtIds.push(doubtId);
    }
    console.log(`✅ Created ${doubts.length} doubts`);

    // Answers for first two doubts
    const answersData = [
      {
        doubt_id: doubtIds[0], user_id: alumniIds[0],
        content: 'Virtual memory is an abstraction that gives each process the illusion of a contiguous address space. When a process accesses a page not in RAM (page fault), the OS finds the page on disk (swap), loads it into a free frame, and updates the page table. If no free frame is available, it evicts a page using an algorithm like LRU. The TLB (Translation Lookaside Buffer) caches recent page table entries to speed up address translation.',
        upvotes: 12, is_accepted: true
      },
      {
        doubt_id: doubtIds[1], user_id: alumniIds[1],
        content: 'INNER JOIN returns only rows with matching values in both tables. LEFT JOIN returns all rows from the left table and matching rows from the right (NULL if no match). RIGHT JOIN is the opposite. FULL OUTER JOIN returns all rows from both tables, with NULLs where there is no match.',
        upvotes: 15, is_accepted: true
      }
    ];

    for (const a of answersData) {
      const answerId = uuidv4();
      await db.query(
        `INSERT INTO doubt_answers (id, doubt_id, author_id, content, upvotes, is_accepted)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [answerId, a.doubt_id, a.user_id, a.content, a.upvotes, a.is_accepted]
      );
    }
    console.log('✅ Created answers for doubts');

    // 6. Gigs
    const gigs = [
      {
        title: 'React Frontend for E-commerce App',
        description: 'Build a responsive React frontend for a small e-commerce site. Must include product listing, cart, and checkout pages. Tailwind CSS preferred.',
        category: 'Web Development', compensation: 8000, duration_days: 14,
        skills_required: 'React,Tailwind CSS,REST APIs', company_email: 'hr@techstartup.com',
        status: 'open', max_students: 2
      },
      {
        title: 'Python Script for Data Cleaning',
        description: 'Write a Python script to clean and preprocess a 50K row CSV dataset. Handle missing values, duplicates, and format normalization.',
        category: 'Data Science', compensation: 3000, duration_days: 7,
        skills_required: 'Python,Pandas,NumPy', company_email: 'talent@codecraft.com',
        status: 'open', max_students: 1
      },
      {
        title: 'Logo and Brand Identity Design',
        description: 'Design a logo and basic brand identity (color palette, typography, business card) for a new ed-tech startup.',
        category: 'Graphic Design', compensation: 5000, duration_days: 10,
        skills_required: 'Figma,Adobe Illustrator,Graphic Design', company_email: 'hr@techstartup.com',
        status: 'open', max_students: 1
      }
    ];

    const gigIds = [];
    for (const g of gigs) {
      const gigId = uuidv4();
      const result = await db.query(
        `SELECT id FROM users WHERE email = $1`,
        [g.company_email]
      );
      const companyId = result.rows[0].id;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);

      await db.query(
        `INSERT INTO gigs (id, company_id, title, description, category, skills_required,
                          compensation, duration_days, max_students, status, application_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [gigId, companyId, g.title, g.description, g.category, g.skills_required.split(','),
         g.compensation, g.duration_days, g.max_students || 1, g.status, deadline.toISOString()]
      );
      gigIds.push(gigId);
    }
    console.log(`✅ Created ${gigs.length} gigs`);

    // 7. Gig Applications
    for (let i = 0; i < 2; i++) {
      await db.query(
        `INSERT INTO gig_applications (id, gig_id, student_id, cover_letter, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), gigIds[i], studentIds[0], 'I am interested in this project and have the required skills.', 'pending']
      );
      await db.query(
        `INSERT INTO gig_applications (id, gig_id, student_id, cover_letter, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), gigIds[i], studentIds[1], 'I have experience with this tech stack. Would love to contribute.', 'shortlisted']
      );
    }
    console.log('✅ Created gig applications');

    // 8. Mentorship Requests
    for (let i = 0; i < 2; i++) {
      await db.query(
        `INSERT INTO mentorship_requests (id, student_id, mentor_id, message, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), studentIds[i], alumniIds[0], 'DSA Preparation - I need guidance for my upcoming placement.', i === 0 ? 'pending' : 'accepted']
      );
    }
    console.log('✅ Created mentorship requests');

    // 9. Badges
    await db.query(
      `INSERT INTO user_badges (id, user_id, badge_id, earned_at)
       SELECT $1, $2, b.id, NOW()
       FROM badges b WHERE b.name = 'First Question'`,
      [uuidv4(), studentIds[0]]
    );
    await db.query(
      `INSERT INTO user_badges (id, user_id, badge_id, earned_at)
       SELECT $1, $2, b.id, NOW()
       FROM badges b WHERE b.name = 'Top Contributor'`,
      [uuidv4(), alumniIds[0]]
    );
    console.log('✅ Assigned badges to users');

    // 10. Notifications
    await db.query(
      `INSERT INTO notifications (id, user_id, type, title, message, is_read)
       VALUES ($1, $2, 'doubt_answer', 'New Answer', 'Your doubt received a new answer', false)`,
      [uuidv4(), studentIds[0]]
    );
    console.log('✅ Created sample notifications');

    // 11. Resources
    const resources = [
      { title: 'DSA Cheat Sheet', description: 'Essential data structures and algorithms with time complexities', resource_type: 'document', subject: 'programming', difficulty_level: 'intermediate', file_url: '/files/dsa-cheatsheet.pdf' },
      { title: 'SQL Joins Visual Guide', description: 'Visual explanation of all SQL join types with examples', resource_type: 'document', subject: 'databases', difficulty_level: 'beginner', file_url: '/files/sql-joins.pdf' },
      { title: 'OS Interview Questions', description: 'Top 50 operating systems interview questions and answers', resource_type: 'document', subject: 'operating-systems', difficulty_level: 'intermediate', file_url: '/files/os-interview.pdf' },
      { title: 'React Crash Course', description: 'FreeCodeCamp React tutorial for beginners', resource_type: 'video', subject: 'webdev', difficulty_level: 'beginner', file_url: 'https://youtube.com/watch?v=example' }
    ];

    for (const r of resources) {
      await db.query(
        `INSERT INTO resources (id, title, description, resource_type, subject, difficulty_level, file_url, uploader_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), r.title, r.description, r.resource_type, r.subject, r.difficulty_level, r.file_url, adminId]
      );
    }
    console.log(`✅ Created ${resources.length} resources`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Test accounts:');
    console.log('   Admin:    admin@nextgencampus.com / admin123');
    console.log('   Student:  sujal@student.com / password123');
    console.log('   Student:  priya@student.com / password123');
    console.log('   Mentor:   mentor1@alumni.com / password123');
    console.log('   Company:  hr@techstartup.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seed();
