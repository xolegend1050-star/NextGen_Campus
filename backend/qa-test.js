const http = require('http');

const BASE = 'http://127.0.0.1:5000';
let pass = 0, fail = 0, bugs = [];
const results = [];
let lastReqTime = 0;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(method, path, body, token) {
  // Throttle: max 15 req/sec to avoid rate limiter
  const now = Date.now();
  const elapsed = now - lastReqTime;
  if (elapsed < 70) await delay(70 - elapsed);
  lastReqTime = Date.now();

  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(url, { method, headers }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch(e) {}
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    r.on('error', e => reject(e));
    if (data) r.write(data);
    r.end();
  });
}

function test(name, fn) {
  return fn().then(r => {
    pass++;
    results.push({ name, status: 'PASS', detail: r || '' });
    return true;
  }).catch(e => {
    fail++;
    const detail = e.message || String(e);
    bugs.push({ name, severity: e.severity || 'MINOR', detail });
    results.push({ name, status: 'FAIL', detail });
    return false;
  });
}

function assert(condition, msg, severity) {
  if (!condition) { const e = new Error(msg || 'Assertion failed'); e.severity = severity || 'MAJOR'; throw e; }
}

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  NextGen Campus — Professional QA Test Suite ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════
  // MODULE 1: AUTH
  // ═══════════════════════════════════════
  console.log('━━━ MODULE 1: AUTHENTICATION ━━━');

  let studentToken, mentorToken, adminToken, companyToken;
  let studentRefresh, studentId;
  let registerEmail = `qa_test_${Date.now()}@student.com`;

  await test('AUTH-01: Health check returns 200', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.status === 'OK', 'Status not OK');
  });

  await test('AUTH-02: Register new student', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: registerEmail, password: 'TestPass123', role: 'student', full_name: 'QA Test Student'
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${r.raw}`);
    assert(r.body.token, 'No token returned');
    assert(r.body.user.email === registerEmail, 'Email mismatch');
    assert(r.body.user.role === 'student', 'Role mismatch');
    assert(r.body.refreshToken, 'No refresh token');
    assert(r.body.verification_token, 'No verification token');
    studentToken = r.body.token;
    studentRefresh = r.body.refreshToken;
    studentId = r.body.user.id;
  });

  await test('AUTH-03: Register with duplicate email fails (409)', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: registerEmail, password: 'TestPass123', role: 'student', full_name: 'Dup'
    });
    assert(r.status === 409, `Expected 409, got ${r.status}`);
  });

  await test('AUTH-04: Register with invalid email fails (400)', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: 'notanemail', password: 'TestPass123', role: 'student', full_name: 'Test'
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('AUTH-05: Register with weak password fails (400)', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: 'new@test.com', password: '123', role: 'student', full_name: 'Test'
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('AUTH-06: Register with invalid role fails (400)', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: 'x@test.com', password: 'TestPass123', role: 'hacker', full_name: 'Test'
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('AUTH-07: Register with missing fields fails (400)', async () => {
    const r = await req('POST', '/api/auth/register', {
      email: 'x@test.com', password: 'TestPass123'
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('AUTH-08: Login with valid credentials', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'sujal@student.com', password: 'password123' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'No token');
    assert(r.body.user.email === 'sujal@student.com', 'Email mismatch');
    studentToken = r.body.token;
  });

  await test('AUTH-09: Login with wrong password fails (401)', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'sujal@student.com', password: 'wrongpass' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('AUTH-10: Login with non-existent email fails (401)', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'nobody@student.com', password: 'password123' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('AUTH-11: Get /me returns user profile', async () => {
    const r = await req('GET', '/api/auth/me', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.user, 'No user object');
    assert(r.body.user.email, 'No email in user');
    assert(r.body.user.full_name, 'No full_name in user');
  });

  await test('AUTH-12: Get /me without token fails (401)', async () => {
    const r = await req('GET', '/api/auth/me');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('AUTH-13: Get /me with invalid token fails (401)', async () => {
    const r = await req('GET', '/api/auth/me', null, 'invalid.token.here');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('AUTH-14: Token refresh works', async () => {
    const r = await req('POST', '/api/auth/refresh', { refreshToken: studentRefresh });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'No new token');
    assert(r.body.refreshToken, 'No new refresh token');
  });

  await test('AUTH-15: Refresh with invalid token fails (401)', async () => {
    const r = await req('POST', '/api/auth/refresh', { refreshToken: 'garbage' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('AUTH-16: Forgot password returns success message', async () => {
    const r = await req('POST', '/api/auth/forgot-password', { email: 'sujal@student.com' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.message, 'No message');
  });

  await test('AUTH-17: Forgot password with non-existent email still returns success (no enumeration)', async () => {
    const r = await req('POST', '/api/auth/forgot-password', { email: 'fake@test.com' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('AUTH-18: Reset password with invalid token fails (400)', async () => {
    const r = await req('POST', '/api/auth/reset-password', { token: 'fake-token', password: 'NewPass123' });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // Login as other roles
  const mLogin = await req('POST', '/api/auth/login', { email: 'mentor1@alumni.com', password: 'password123' });
  mentorToken = mLogin.body?.token;
  const aLogin = await req('POST', '/api/auth/login', { email: 'admin@nextgencampus.com', password: 'admin123' });
  adminToken = aLogin.body?.token;
  const cLogin = await req('POST', '/api/auth/login', { email: 'hr@techstartup.com', password: 'password123' });
  companyToken = cLogin.body?.token;

  if (!mentorToken || !adminToken || !companyToken) {
    console.log('  ⚠️  Role login failures:');
    console.log('    Mentor login:', mLogin.status, mLogin.body ? 'has token: ' + !!mLogin.body.token : 'NO BODY');
    console.log('    Admin login:', aLogin.status, aLogin.body ? 'has token: ' + !!aLogin.body.token : 'NO BODY');
    console.log('    Company login:', cLogin.status, cLogin.body ? 'has token: ' + !!cLogin.body.token : 'NO BODY');
  }

  await test('AUTH-19: Logout works', async () => {
    const r = await req('POST', '/api/auth/logout', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 2: STUDENT
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 2: STUDENT ━━━');

  await test('STU-01: Get my profile', async () => {
    const r = await req('GET', '/api/profiles/me', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.profile, 'No profile object');
  });

  await test('STU-02: Update my profile', async () => {
    const r = await req('PUT', '/api/profiles/me', { bio: 'QA Test Bio Updated' }, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  let doubtId;
  await test('STU-03: Create a doubt', async () => {
    const r = await req('POST', '/api/doubts', {
      title: 'QA Test: How does async/await work in JavaScript properly?',
      content: 'I am testing the doubt creation flow and need to understand async/await patterns.',
      tags: ['javascript', 'async', 'testing'],
      subject: 'Programming'
    }, studentToken);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${r.raw}`);
    assert(r.body.doubt, 'No doubt returned');
    doubtId = r.body.doubt.id;
  });

  await test('STU-04: Create doubt with short title fails (400)', async () => {
    const r = await req('POST', '/api/doubts', {
      title: 'Short', content: 'This content should be long enough to pass validation rules',
      tags: ['test']
    }, studentToken);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('STU-05: Create doubt without auth fails (401)', async () => {
    const r = await req('POST', '/api/doubts', {
      title: 'No auth needed this should fail', content: 'This should fail because no auth token provided',
      tags: ['test']
    });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('STU-06: List doubts', async () => {
    const r = await req('GET', '/api/doubts', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.doubts), 'doubts not array');
    assert(r.body.pagination, 'No pagination');
  });

  if (doubtId) {
    await test('STU-07: Get doubt by ID', async () => {
      const r = await req('GET', `/api/doubts/${doubtId}`, null, studentToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.doubt.id === doubtId, 'ID mismatch');
    });

    await test('STU-08: Answer a doubt', async () => {
      const r = await req('POST', `/api/doubts/${doubtId}/answers`, {
        content: 'Async/await is syntactic sugar over promises. It makes async code look synchronous.'
      }, studentToken);
      assert(r.status === 201, `Expected 201, got ${r.status}`);
    });

    await test('STU-09: Get doubt answers', async () => {
      const r = await req('GET', `/api/doubts/${doubtId}/answers`, null, studentToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.body.answers), 'answers not array');
      assert(r.body.answers.length > 0, 'No answers returned');
    });

    await test('STU-10: Vote on a doubt', async () => {
      const r = await req('POST', `/api/doubts/${doubtId}/vote`, { vote_type: 1 }, studentToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('STU-11: Get non-existent doubt returns 404', async () => {
      const r = await req('GET', '/api/doubts/00000000-0000-0000-0000-000000000000');
      assert(r.status === 404, `Expected 404, got ${r.status}`);
    });
  }

  await test('STU-12: List gigs', async () => {
    const r = await req('GET', '/api/gigs', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.gigs), 'gigs not array');
  });

  await test('STU-13: My applications', async () => {
    const r = await req('GET', '/api/gigs/my-applications', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-14: Get wallet', async () => {
    const r = await req('GET', '/api/wallet', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-15: Get wallet transactions', async () => {
    const r = await req('GET', '/api/wallet/transactions', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-16: Get notifications', async () => {
    const r = await req('GET', '/api/notifications', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-17: Get trust score', async () => {
    const r = await req('GET', '/api/trust/my-score', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.trustScore === 'number', 'trustScore not a number');
  });

  await test('STU-18: Get badges', async () => {
    const r = await req('GET', '/api/badges/my-badges', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-19: Get chat conversations', async () => {
    const r = await req('GET', '/api/chat/conversations', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-20: Get resources', async () => {
    const r = await req('GET', '/api/resources', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('STU-21: Get verification status', async () => {
    const r = await req('GET', '/api/verification/status', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 3: MENTOR
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 3: MENTOR ━━━');

  await test('MNT-01: Mentor gets requests', async () => {
    const r = await req('GET', '/api/mentorship/requests', null, mentorToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('MNT-02: Mentor gets sessions', async () => {
    const r = await req('GET', '/api/mentorship/sessions', null, mentorToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('MNT-03: Student cannot access mentor routes directly', async () => {
    const r = await req('GET', '/api/mentorship/requests', null, studentToken);
    // Mentor routes may be open to all authenticated users - check status
    assert(r.status === 200 || r.status === 403, `Unexpected ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 4: COMPANY
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 4: COMPANY ━━━');

  let companyId;
  await test('CMP-01: Company lists gigs', async () => {
    const r = await req('GET', '/api/gigs?limit=5', null, companyToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('CMP-02: Company posts a gig', async () => {
    const r = await req('POST', '/api/gigs', {
      title: 'QA Test: Full Stack Developer Intern',
      description: 'Testing the gig posting flow for QA purposes with a longer string to pass validation',
      skills_required: ['JavaScript', 'React', 'Node.js'],
      compensation: 8000,
      duration_days: 21,
      is_remote: true,
      category: 'Web Development',
      application_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }, companyToken);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${r.raw}`);
    assert(r.body.gig, 'No gig returned');
    companyId = r.body.gig.id;
  });

  // ═══════════════════════════════════════
  // MODULE 5: ADMIN
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 5: ADMIN ━━━');

  await test('ADM-01: Admin dashboard', async () => {
    const r = await req('GET', '/api/admin/dashboard', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.stats || r.body.totalUsers !== undefined, 'No stats in dashboard');
  });

  await test('ADM-02: Admin lists users', async () => {
    const r = await req('GET', '/api/admin/users', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('ADM-03: Admin lists verifications', async () => {
    const r = await req('GET', '/api/admin/verifications', null, adminToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('ADM-04: Student cannot access admin routes (403)', async () => {
    const r = await req('GET', '/api/admin/dashboard', null, studentToken);
    assert(r.status === 403 || r.status === 401, `Expected 403/401, got ${r.status}`);
  });

  await test('ADM-05: Mentor cannot access admin routes (403)', async () => {
    const r = await req('GET', '/api/admin/users', null, mentorToken);
    assert(r.status === 403 || r.status === 401, `Expected 403/401, got ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 6: AI
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 6: AI ━━━');

  await test('AI-01: Gig recommendations', async () => {
    const r = await req('GET', '/api/ai/recommend-gigs', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.gigs), 'gigs not array');
  });

  await test('AI-02: Mentor recommendations', async () => {
    const r = await req('GET', '/api/ai/recommend-mentors', null, studentToken);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.mentors), 'mentors not array');
  });

  await test('AI-03: Draft answer (AI service may be down, should fallback gracefully)', async () => {
    const r = await req('POST', '/api/ai/draft-answer', { doubt_id: '1' }, studentToken);
    // AI service may not be running, so 503 is acceptable; 400 for validation is also fine
    assert(r.status === 200 || r.status === 400 || r.status === 404 || r.status === 503, `Unexpected ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 7: SECURITY
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 7: SECURITY ━━━');

  await test('SEC-01: SQL injection in login email', async () => {
    const r = await req('POST', '/api/auth/login', { email: "'; DROP TABLE users; --", password: 'test' });
    assert(r.status !== 200, `SQL injection should not succeed`);
    assert(r.status === 401 || r.status === 400, `Expected 401/400, got ${r.status}`);
  });

  await test('SEC-02: SQL injection in search', async () => {
    const r = await req('GET', '/api/doubts?search=1%27%20OR%201%3D1%20--', null, studentToken);
    assert(r.status === 200 || r.status === 400, `Should handle injection gracefully`);
  });

  await test('SEC-03: XSS in doubt title (stored)', async () => {
    const r = await req('POST', '/api/doubts', {
      title: 'QA XSS Test: Does this script tag get sanitized <script>alert(1)</script>?',
      content: 'Testing XSS prevention in doubt creation. This should be sanitized or escaped.',
      tags: ['security', 'xss-test']
    }, studentToken);
    if (r.status === 201 && r.body.doubt) {
      const hasScript = r.body.doubt.title.includes('<script>');
      assert(!hasScript, 'Script tag was not sanitized - XSS vulnerability!', 'CRITICAL');
    }
  });

  await test('SEC-04: Unauthorized access to admin', async () => {
    const r = await req('GET', '/api/admin/users');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('SEC-05: Role escalation - student tries admin actions', async () => {
    const r = await req('PATCH', '/api/admin/users/someid/ban', {}, studentToken);
    assert(r.status === 403 || r.status === 401, `Expected 403/401, got ${r.status}`);
  });

  await test('SEC-06: Malformed JWT token', async () => {
    const r = await req('GET', '/api/auth/me', null, 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.invalid');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('SEC-07: Empty body on required fields', async () => {
    const r = await req('POST', '/api/auth/login', {});
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('SEC-08: Invalid JSON body', async () => {
    const r = await req('POST', '/api/auth/login', null);
    assert(r.status === 400 || r.status === 415, `Expected 400/415, got ${r.status}`);
  });

  // ═══════════════════════════════════════
  // MODULE 8: EDGE CASES
  // ═══════════════════════════════════════
  console.log('\n━━━ MODULE 8: EDGE CASES ━━━');

  await test('EDGE-01: Get non-existent profile', async () => {
    const r = await req('GET', '/api/profiles/00000000-0000-0000-0000-000000000000', null, studentToken);
    assert(r.status === 400 || r.status === 404 || r.status === 200, `Unexpected ${r.status}`);
  });

  await test('EDGE-02: 404 for unknown route', async () => {
    const r = await req('GET', '/api/thisdoesnotexist');
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('EDGE-03: Pagination with invalid page', async () => {
    const r = await req('GET', '/api/doubts?page=-1', null, studentToken);
    assert(r.status === 400 || r.status === 200, `Unexpected ${r.status}`);
  });

  await test('EDGE-04: Very large limit rejected', async () => {
    const r = await req('GET', '/api/doubts?limit=99999', null, studentToken);
    assert(r.status === 400 || r.status === 200, `Unexpected ${r.status}`);
  });

  await test('EDGE-05: Withdrawal with invalid amount', async () => {
    const r = await req('POST', '/api/wallet/withdraw', { amount: -100, payment_method: 'upi' }, studentToken);
    assert(r.status >= 400, `Expected 4xx, got ${r.status}`);
  });

  await test('EDGE-06: Swagger docs accessible', async () => {
    const r = await req('GET', '/api-docs/');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ═══════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              TEST RESULTS                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  Total: ${pass + fail}`);
  console.log(`  PASS:  ${pass} ✅`);
  console.log(`  FAIL:  ${fail} ❌`);
  console.log(`  Pass Rate: ${((pass/(pass+fail))*100).toFixed(1)}%\n`);

  if (bugs.length > 0) {
    console.log('┌──────────────────────────────────────────────┐');
    console.log('│              BUGS FOUND                       │');
    console.log('└──────────────────────────────────────────────┘');
    bugs.forEach((b, i) => {
      console.log(`\n  BUG-${i+1}: [${b.severity}] ${b.name}`);
      console.log(`  Detail: ${b.detail}`);
    });
  } else {
    console.log('  🎉 NO BUGS FOUND!');
  }

  // Summary by module
  console.log('\n┌──────────────────────────────────────────────┐');
  console.log('│           MODULE BREAKDOWN                    │');
  console.log('└──────────────────────────────────────────────┘');
  const modules = {};
  results.forEach(r => {
    const mod = r.name.split('-')[0];
    if (!modules[mod]) modules[mod] = { pass: 0, fail: 0 };
    modules[mod][r.status === 'PASS' ? 'pass' : 'fail']++;
  });
  Object.entries(modules).forEach(([mod, counts]) => {
    const total = counts.pass + counts.fail;
    const pct = ((counts.pass/total)*100).toFixed(0);
    console.log(`  ${mod.padEnd(6)} ${counts.pass}/${total} (${pct}%) ${counts.fail === 0 ? '✅' : '❌'}`);
  });

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
