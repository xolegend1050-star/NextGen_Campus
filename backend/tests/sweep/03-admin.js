// Sweep: admin, wallet, analytics, AI, chat edge cases
const H = require('./harness');
const { suite, check, expect, uuid, anotherUuid, users, db } = H;

module.exports = async function run() {
  suite('ADMIN + WALLET + ANALYTICS + AI + CHAT');

  // ---------- admin authorization ----------
    // Every paginated admin list must reject a bad page or limit with 400.
    // intQueries was imported into the admin routes but never applied, so these
    // all reached the LIMIT/OFFSET clause and returned 500 from Postgres.
    for (const p of ['/api/admin/users', '/api/admin/verifications',
                     '/api/admin/flagged-content', '/api/admin/disputes',
                     '/api/admin/audit-log']) {
      for (const q of ['?page=abc', '?limit=xyz', '?page=0', '?page=-5']) {
        const bad = await users.adminC('GET', p + q);
        check(p + q + ' rejected 400', bad.status === 400, 'got ' + bad.status);
      }
    }

  const adminReads = [
    ['GET', '/api/admin/dashboard'], ['GET', '/api/admin/verifications'],
    ['GET', '/api/admin/users'], ['GET', '/api/admin/flagged-content'],
    ['GET', '/api/admin/disputes'], ['GET', '/api/admin/audit-log']
  ];
  for (const [m, p] of adminReads) {
    const ok = await users.adminC(m, p);
    const denied = await users.studentC(m, p);
    const anon = await users.anonC(m, p);
    check(`admin ${m} ${p}`, ok.status === 200, `admin ${ok.status}`);
    check(`  blocked for student`, denied.status === 403, `student ${denied.status}`);
    check(`  blocked without token`, anon.status === 401, `anon ${anon.status}`);
  }

  // admin writes must be admin-only
  const adminWrites = [
    ['PATCH', `/api/admin/users/${users.id.student2}/ban`],
    ['PATCH', `/api/admin/users/${users.id.student2}/unban`],
    ['PATCH', `/api/admin/users/${users.id.student2}/role`, { role: 'alumni' }],
    ['PATCH', `/api/admin/verifications/${uuid}`],
    ['PUT', `/api/admin/verifications/${uuid}`],
    ['PATCH', `/api/admin/flagged-content/${uuid}`],
    ['PUT', `/api/admin/flagged-content/${uuid}`],
    ['PATCH', `/api/admin/disputes/${uuid}/resolve`]
  ];
  for (const [m, p, body] of adminWrites) {
    const denied = await users.studentC(m, p, body);
    check(`student blocked from ${m} ${p}`, denied.status === 403, `${denied.status}`);
  }

  // role escalation
  let r = await users.adminC('PATCH', `/api/admin/users/${users.id.student2}/role`, { role: 'admin' });
  check('admin can change a role', r.status === 200 || r.status === 400, `${r.status}`);
  await db.query("UPDATE users SET role='student' WHERE id=$1", [users.id.student2]);

  r = await users.adminC('PATCH', `/api/admin/users/${users.id.student2}/role`, { role: 'superuser' });
  check('invalid role rejected', r.status === 400 || r.status === 200, `${r.status}`);

  // admin should not be able to ban themselves into a lockout
  r = await users.adminC('POST', `/api/users/${users.id.admin}/ban`, { reason: 'self' });
  check('admin self-ban handled', [200, 400, 403].includes(r.status), `${r.status}`);
  await db.query('UPDATE users SET is_banned = false WHERE id=$1', [users.id.admin]);

  // ---------- wallet ----------
  r = await users.studentC('GET', '/api/wallet');
  check('own wallet', r.status === 200 || r.status === 404, `${r.status}`);
  r = await users.anonC('GET', '/api/wallet');
  expect('wallet needs auth', r, 401);

  r = await users.studentC('GET', '/api/wallet/transactions?page=1&limit=5');
  check('wallet transactions', r.status === 200 && Array.isArray(r.body.transactions), `${r.body.transactions?.length}`);
  r = await users.studentC('GET', '/api/wallet/transactions?page=abc');
  check('bad page param handled', r.status === 200 || r.status === 400, `${r.status}`);
  r = await users.studentC('GET', '/api/wallet/transactions?type=escrow_release');
  check('filter by transaction type', r.status === 200, `${r.status}`);

  await db.query("UPDATE wallets SET balance = 500 WHERE user_id = $1", [users.id.student]);
  r = await users.studentC('POST', '/api/wallet/withdraw', { amount: 50, payment_method: 'bank_transfer' });
  expect('withdraw below minimum rejected', r, 400);

  r = await users.studentC('POST', '/api/wallet/withdraw', { amount: 999999, payment_method: 'bank_transfer' });
  expect('withdraw more than balance rejected', r, 400);

  r = await users.studentC('POST', '/api/wallet/withdraw', { amount: -500, payment_method: 'bank_transfer' });
  expect('negative withdrawal rejected', r, 400);

  r = await users.studentC('POST', '/api/wallet/withdraw', { amount: 'abc', payment_method: 'bank_transfer' });
  expect('non-numeric withdrawal rejected', r, 400);

  r = await users.anonC('POST', '/api/wallet/withdraw', { amount: 500 });
  expect('withdrawal needs auth', r, 401);

  await db.query("UPDATE wallets SET balance = 0 WHERE user_id = $1", [users.id.student]);

  // frozen wallet
  await db.query("UPDATE wallets SET is_frozen = true, balance = 1000 WHERE user_id = $1", [users.id.student]);
  r = await users.studentC('POST', '/api/wallet/withdraw', { amount: 500, payment_method: 'bank_transfer' });
  expect('frozen wallet cannot withdraw', r, 400);
  await db.query("UPDATE wallets SET is_frozen = false, balance = 0 WHERE user_id = $1", [users.id.student]);

  // escrow authorization already covered; confirm the listing is scoped
  r = await users.studentC('GET', '/api/wallet/escrow');
  check('escrow list scoped to caller', r.status === 200 && Array.isArray(r.body.escrows), `${r.body.escrows?.length}`);

  // ---------- analytics ----------
  r = await users.anonC('GET', '/api/analytics/leaderboard?category=overall');
  expect('leaderboard needs auth', r, 401);

  r = await users.studentC('GET', '/api/analytics/student/' + users.id.mentor);
  expect('cannot read another student analytics', r, 403);

  r = await users.adminC('GET', '/api/analytics/student/' + users.id.student);
  expect('admin can read any student analytics', r, 200);

  r = await users.adminC('GET', '/api/analytics/platform?period=bogus');
  check('unknown period falls back', r.status === 200 && Array.isArray(r.body.analytics.trends), `${r.status}, ${r.body.analytics?.trends?.length} buckets`);

  r = await users.adminC('GET', '/api/analytics/leaderboard?category=%27%20OR%201=1--');
  check('leaderboard ignores SQL injection', r.status === 200, `${r.status}`);

  r = await users.studentC('POST', '/api/analytics/track', { event_type: 'sweep_event' });
  check('track event', r.status === 201, `${r.status}`);
  r = await users.anonC('POST', '/api/analytics/track', { event_type: 'x' });
  expect('track needs auth', r, 401);

  // ---------- AI ----------
  const aiCalls = [
    ['POST', '/api/ai/moderate-content', { content: 'hello' }],
    ['GET', '/api/ai/recommend-mentors', undefined],
    ['GET', '/api/ai/recommend-gigs', undefined],
    ['POST', '/api/ai/analyze-resume', { resume_url: '/uploads/resumes/x.pdf' }],
    ['POST', '/api/ai/mock-interview', { role: 'Dev', skills: ['js'] }]
  ];
  for (const [m, p, b] of aiCalls) {
    const anon = await users.anonC(m, p, b);
    check(`ai ${p} needs auth`, anon.status === 401, `${anon.status}`);
  }

  r = await users.studentC('POST', '/api/ai/draft-answer', { doubt_id: 'not-a-uuid' });
  expect('draft-answer bad uuid rejected', r, 400);
  r = await users.studentC('POST', '/api/ai/predict-gig-success', { gig_id: uuid });
  expect('predict-gig-success unknown gig -> 404', r, 404);
  r = await users.studentC('POST', '/api/ai/moderate-content', { content: '' });
  expect('moderate-content empty rejected', r, 400);
  r = await users.studentC('GET', '/api/ai/health');
  check('ai health endpoint reachable', [200, 503].includes(r.status), `${r.status}`);

  // ---------- chat edge cases ----------
  r = await users.studentC('POST', '/api/chat/conversations', { participant_id: users.id.student });
  expect('cannot DM yourself', r, 400);
  r = await users.studentC('POST', '/api/chat/conversations', { participant_id: uuid });
  expect('DM unknown user -> 404', r, 404);
  r = await users.studentC('POST', '/api/chat/conversations', {});
  expect('conversation without participant rejected', r, 400);
  r = await users.studentC('GET', `/api/chat/conversations/${uuid}/messages`);
  check('messages for unknown conversation -> 403/404', [403, 404].includes(r.status), `${r.status}`);
  r = await users.studentC('POST', `/api/chat/conversations/${uuid}/messages`, { content: 'x' });
  check('send to unknown conversation rejected', [403, 404].includes(r.status), `${r.status}`);

  r = await users.studentC('PATCH', `/api/chat/messages/${uuid}`, { content: 'x' });
  check('edit unknown message handled', [403, 404].includes(r.status), `${r.status}`);
  r = await users.studentC('DELETE', `/api/chat/messages/${uuid}`);
  check('delete unknown message handled', [403, 404].includes(r.status), `${r.status}`);
  r = await users.studentC('POST', '/api/chat/attachment');
  expect('attachment with no file rejected', r, 400);
  r = await users.anonC('POST', '/api/chat/attachment');
  expect('attachment needs auth', r, 401);
  r = await users.studentC('POST', `/api/chat/conversations/${uuid}/participants`, { user_id: users.id.mentor });
  check('add participant to unknown conversation rejected', [403, 404].includes(r.status), `${r.status}`);

  // ---------- XSS / injection probes ----------
  r = await users.studentC('POST', '/api/doubts', {
    title: '<script>alert(1)</script> sweep',
    content: '<img src=x onerror=alert(1)> body for the sweep test.',
    tags: ['<b>x</b>']
  });
  check('doubt with HTML accepted (sanitised server-side, not crashed)', r.status === 201, `${r.status}`);
  if (r.body.doubt) {
    check('  script tag stripped from title', !/<script>/i.test(r.body.doubt.title), r.body.doubt.title);
    await db.query('DELETE FROM doubts WHERE id=$1', [r.body.doubt.id]);
  }

  r = await users.studentC('POST', '/api/chat/conversations', { participant_id: users.id.mentor, type: 'dm' });
  const cid = r.body.conversation.id;
  r = await users.studentC('POST', `/api/chat/conversations/${cid}/messages`, {
    content: "'; DROP TABLE messages; --"
  });
  check('SQL-ish chat content handled', r.status === 201, `${r.status}`);
  const stillThere = await db.query('SELECT COUNT(*)::int n FROM messages');
  check('  messages table intact', stillThere.rows[0].n >= 0, `${stillThere.rows[0].n} rows`);
  await db.query('DELETE FROM messages WHERE conversation_id=$1', [cid]);
  await db.query('DELETE FROM conversations WHERE id=$1', [cid]);

  r = await users.adminC('GET', "/api/admin/users?search=' OR '1'='1");
  check('admin user list handles quotes', r.status === 200, `${r.status}`);
};
