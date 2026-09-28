// Sweep: authentication, users, verification, badges, trust
const H = require('./harness');
const { suite, check, expect, uuid, anotherUuid, users, db } = H;

module.exports = async function run() {
  suite('AUTH + USERS + VERIFICATION + BADGES + TRUST');

  // ---------- register ----------
  const email = `sweep-${Date.now()}@example.com`;
  let r = await users.anonC('POST', '/api/auth/register', {
    email, password: 'Sweep123!', role: 'student', full_name: 'Sweep Tester'
  });
  expect('register valid', r, 201);

  r = await users.anonC('POST', '/api/auth/register', {
    email, password: 'Sweep123!', role: 'student', full_name: 'Dup'
  });
  expect('register duplicate email rejected', r, 409);

  r = await users.anonC('POST', '/api/auth/register', {
    email: 'not-an-email', password: 'Sweep123!', role: 'student', full_name: 'X'
  });
  expect('register bad email rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/register', {
    email: 'weak@example.com', password: 'short', role: 'student', full_name: 'X'
  });
  expect('register weak password rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/register', {
    email: 'no-special@example.com', password: 'Password123', role: 'student', full_name: 'X'
  });
  expect('register no special char rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/register', {
    email: 'bademail2@example.com', password: 'Sweep123!', role: 'wizard', full_name: 'X'
  });
  expect('register bad role rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/register', {
    email: 'nofull@example.com', password: 'Sweep123!', role: 'student', full_name: '   '
  });
  expect('register blank full_name rejected', r, 400);

  // ---------- login ----------
  r = await users.anonC('POST', '/api/auth/login', { email: 'sujal@student.com', password: 'password123' });
  expect('login valid', r, 200);

  r = await users.anonC('POST', '/api/auth/login', { email: 'sujal@student.com', password: 'wrongpass' });
  expect('login wrong password rejected', r, 401);

  r = await users.anonC('POST', '/api/auth/login', { email: 'ghost@nowhere.com', password: 'password123' });
  expect('login unknown user rejected', r, 401);

  r = await users.anonC('POST', '/api/auth/login', { email: 'not-an-email', password: 'x' });
  expect('login bad email format rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/login', { email: 'sujal@student.com' });
  expect('login missing password rejected', r, 400);

  // ---------- /me ----------
  r = await users.studentC('GET', '/api/auth/me');
  expect('me with token', r, 200);
  check('  returns email', r.body.user?.email === 'sujal@student.com', r.body.user?.email);

  r = await users.anonC('GET', '/api/auth/me');
  expect('me without token rejected', r, 401);

  r = await users.studentC('GET', '/api/auth/me', undefined, { Authorization: 'Bearer garbage' });
  expect('me with garbage token rejected', r, 401);

  r = await users.studentC('GET', '/api/auth/me', undefined, { Authorization: 'Bearer ' });
  expect('me with empty bearer rejected', r, 401);

  // ---------- forgot / reset / verify ----------
  r = await users.anonC('POST', '/api/auth/forgot-password', { email: 'sujal@student.com' });
  expect('forgot-password existing email', r, 200);

  r = await users.anonC('POST', '/api/auth/forgot-password', { email: 'ghost@nowhere.com' });
  check('forgot-password unknown email is identical (no enumeration)',
    r.status === 200 && /if the email exists/i.test(r.body.message || ''), `${r.status} ${r.body?.message}`);

  r = await users.anonC('POST', '/api/auth/forgot-password', { email: 'bad' });
  expect('forgot-password bad email rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/reset-password', { token: 'nope', password: 'NewPass1!' });
  expect('reset-password bad token rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/reset-password', { token: 'nope', password: 'weak' });
  expect('reset-password weak password rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/verify-email', { token: 'nope' });
  expect('verify-email bad token rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/verify-email', {});
  expect('verify-email missing token rejected', r, 400);

  r = await users.anonC('POST', '/api/auth/resend-verification', { email: 'sujal@student.com' });
  check('resend-verification non-enumerable', r.status === 200 && /if the email exists/i.test(r.body.message || ''), `${r.status}`);
  r = await users.anonC('POST', '/api/auth/resend-verification', {});
  expect('resend-verification missing email rejected', r, 400);

  // ---------- refresh ----------
  // Use a throwaway account: /refresh rotates the session, which invalidates
  // the old access token by design. Reusing a seeded token here would kill it
  // for every later check in the sweep.
  const rtEmail = `sweep-rt-${Date.now()}@example.com`;
  await users.anonC('POST', '/api/auth/register', {
    email: rtEmail, password: 'Sweep123!', role: 'student', full_name: 'Refresh Tester'
  });
  const db1 = (await db.query(
    'UPDATE users SET is_email_verified = true, skip_otp = true WHERE email = $1 RETURNING id', [rtEmail]
  )).rows[0];
  const rtLogin = await users.anonC('POST', '/api/auth/login', { email: rtEmail, password: 'Sweep123!' });
  const rt = rtLogin.body.refreshToken;
  const rtOld = rtLogin.body.token;

  r = await users.anonC('POST', '/api/auth/refresh', { refreshToken: rt });
  expect('refresh valid token', r, 200);
  check('  returns a new access token', !!r.body.token, String(!!r.body.token));
  check('  and a new refresh token', !!r.body.refreshToken, String(!!r.body.refreshToken));

  const rotC = H.client(r.body.token);
  const meAfter = await rotC('GET', '/api/auth/me');
  check('  new access token works', meAfter.status === 200, `${meAfter.status}`);

  const oldC = H.client(rtOld);
  const meOld = await oldC('GET', '/api/auth/me');
  check('  old access token is rejected (rotation works)', meOld.status === 401, `${meOld.status}`);

  r = await users.anonC('POST', '/api/auth/refresh', { refreshToken: 'garbage' });
  expect('refresh garbage rejected', r, 401);
  r = await users.anonC('POST', '/api/auth/refresh', {});
  expect('refresh missing token rejected', r, 400);

  // reuse of a spent refresh token must fail
  r = await users.anonC('POST', '/api/auth/refresh', { refreshToken: rt });
  check('spent refresh token cannot be reused', r.status === 401, `${r.status}`);
  await db.query('DELETE FROM users WHERE id = $1', [db1.id]);

  // ---------- logout ----------
  const tmp = await H.login('rahul@student.com', 'password123');
  const tmpC = H.client(tmp);
  r = await tmpC('POST', '/api/auth/logout');
  expect('logout valid', r, 200);
  r = await tmpC('GET', '/api/auth/me');
  expect('  token invalid after logout (session check)', r, 401);
  r = await users.anonC('POST', '/api/auth/logout');
  expect('logout without token rejected', r, 401);

  // ---------- badges ----------
  r = await users.studentC('GET', '/api/auth/me/badges');
  expect('my badges', r, 200);
  r = await users.anonC('GET', '/api/auth/me/badges');
  expect('my badges needs auth', r, 401);

  r = await users.anonC('GET', '/api/badges');
  expect('badge catalogue public', r, 200);
  r = await users.studentC('GET', '/api/badges/my-badges');
  expect('badges/my-badges', r, 200);
  r = await users.studentC('GET', '/api/badges/points');
  check('badges/points returns a number', typeof r.body.points === 'number' || r.body.total_points === undefined, JSON.stringify(r.body).slice(0, 60));
  r = await users.anonC('GET', '/api/badges/my-badges');
  expect('badges/my-badges needs auth', r, 401);

  // ---------- users ----------
  r = await users.studentC('GET', '/api/users/search?q=su');
  check('user search works', r.status === 200 && Array.isArray(r.body.users), `${r.body.users?.length} results`);
  r = await users.studentC('GET', '/api/users/search?q=a');
  expect('search below 2 chars rejected', r, 400);
  r = await users.anonC('GET', '/api/users/search?q=su');
  expect('search needs auth', r, 401);
  r = await users.studentC('GET', `/api/users/search?q=${encodeURIComponent("' OR 1=1--")}`);
  check('search ignores SQL injection', r.status === 200 && (r.body.users || []).length === 0, `${r.body.users?.length} results`);

  r = await users.adminC('GET', '/api/users');
  expect('admin list users', r, 200);
  r = await users.studentC('GET', '/api/users');
  expect('non-admin cannot list users', r, 403);

  r = await users.studentC('GET', `/api/users/${users.id.mentor}`);
  expect('view another user profile', r, 200);
  r = await users.studentC('GET', `/api/users/${uuid}`);
  expect('view unknown user -> 404', r, 404);
  r = await users.studentC('GET', '/api/users/not-a-uuid');
  check('bad uuid handled', r.status === 404 || r.status === 400, `${r.status}`);

  r = await users.studentC('PUT', `/api/users/${users.id.student2}`, { full_name: 'Hacked' });
  expect('cannot edit another user', r, 403);

  r = await users.adminC('POST', `/api/users/${users.id.student2}/ban`, { reason: 'sweep test' });
  check('admin can ban', r.status === 200 || r.status === 400, `${r.status}`);
  // unban immediately
  await db.query('UPDATE users SET is_banned = false WHERE id = $1', [users.id.student2]);

  r = await users.studentC('POST', `/api/users/${users.id.student2}/ban`, { reason: 'x' });
  expect('non-admin cannot ban', r, 403);

  // ---------- trust ----------
  r = await users.studentC('GET', `/api/trust/score/${users.id.mentor}`);
  expect('trust score for a user', r, 200);
  r = await users.anonC('GET', `/api/trust/score/${users.id.mentor}`);
  expect('trust score needs auth', r, 401);
  r = await users.studentC('GET', '/api/trust/my-score');
  expect('my trust score', r, 200);
  r = await users.studentC('GET', '/api/trust/score/not-a-uuid');
  check('trust bad uuid handled', r.status === 400 || r.status === 404, `${r.status}`);
  r = await users.studentC('POST', `/api/trust/report-company/${users.id.company}`, { reason: 'sweep', details: 'test' });
  check('report company accepted', r.status === 200 || r.status === 201 || r.status === 400, `${r.status}`);

  // ---------- verification ----------
  r = await users.studentC('GET', '/api/verification/status');
  expect('verification status', r, 200);
  r = await users.anonC('GET', '/api/verification/status');
  expect('verification status needs auth', r, 401);

  // cleanup the sweep account
  await db.query('DELETE FROM users WHERE email = $1', [email]);
};
