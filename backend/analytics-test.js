// Analytics module: trends, active users, leaderboard typing, authz
require('dotenv').config();
const db = require('./src/config/database');
const API = 'http://localhost:5000';

const results = [];
const check = (n, p, d = '') => { results.push({ n, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`); };

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return (await r.json()).token;
};
const H = t => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
const get = (t, p) => fetch(`${API}${p}`, { headers: H(t) }).then(async r => ({ status: r.status, body: await r.json() }));

(async () => {
  const admin = await login('admin@nextgencampus.com', 'admin123');
  const sujal = await login('sujal@student.com', 'password123');
  const sujalId = (await db.query("SELECT id FROM users WHERE email='sujal@student.com'")).rows[0].id;

  console.log('=== 1. PLATFORM ANALYTICS (admin) ===');
  for (const period of ['24h', '7d', '30d', '90d']) {
    const r = await get(admin, `/api/analytics/platform?period=${period}`);
    const a = r.body.analytics;
    check(`${period} -> 200`, r.status === 200, `${r.status}`);
    if (r.status !== 200) continue;
    check(`  trends has ${a.trends.length} buckets`, a.trends.length > 0, `${a.trends.length}`);
    check('  every bucket has a day', a.trends.every(t => !!t.day), JSON.stringify(a.trends[0]));
    check('  counts are numbers', a.trends.every(t => typeof t.doubts === 'number'), typeof a.trends[0].doubts);
    check('  totals present', a.totals && typeof a.totals.students === 'number', JSON.stringify(a.totals).slice(0, 90));
    check('  escrow breakdown', Array.isArray(a.escrow) && a.escrow.length > 0, `${a.escrow.length} rows`);
  }

  console.log('\n=== 2. TREND BUCKET COUNT MATCHES PERIOD ===');
  for (const [period, expected] of [['24h', 24], ['7d', 7], ['30d', 30], ['90d', 13]]) {
    const r = await get(admin, `/api/analytics/platform?period=${period}`);
    const n = r.body.analytics.trends.length;
    check(`  ${period} -> ${n} buckets`, n === expected, `expected ${expected}, got ${n}`);
  }

  console.log('\n=== 3. ACTIVE USERS (was always 0) ===');
  // bump last_seen_at so the metric has something to report
  await db.query("UPDATE users SET last_seen_at = NOW() WHERE email = 'sujal@student.com'");
  const r7 = await get(admin, '/api/analytics/platform?period=7d');
  check('active > 0 now that last_seen_at is set', r7.body.analytics.users.active > 0, `${r7.body.analytics.users.active}`);
  const r24 = await get(admin, '/api/analytics/platform?period=24h');
  check('  consistent across periods', r24.body.analytics.users.active > 0, `${r24.body.analytics.users.active}`);

  console.log('\n=== 4. LEADERBOARD ===');
  for (const cat of ['overall', 'doubts', 'mentorship', 'gigs']) {
    const r = await get(sujal, `/api/analytics/leaderboard?category=${cat}`);
    const lb = r.body.leaderboard;
    check(`${cat} -> 200 with rows`, r.status === 200 && lb.length > 0, `${lb.length} rows`);
    check('  score is a NUMBER not a string', lb.every(x => typeof x.score === 'number'), typeof lb[0]?.score);
    check('  every row has a name', lb.every(x => !!x.full_name), lb.filter(x => !x.full_name).length + ' blank');
    check('  includes email for fallback', lb.every(x => !!x.email), 'ok');
    check('  sorted desc', lb.every((x, i) => i === 0 || lb[i - 1].score >= x.score), `${lb[0]?.score} >= ${lb[1]?.score}`);
  }

  console.log('\n=== 5. LEADERBOARD PERIOD (was ignored) ===');
  const all = await get(sujal, '/api/analytics/leaderboard?category=overall&period=all_time');
  const wk = await get(sujal, '/api/analytics/leaderboard?category=overall&period=weekly');
  check('period echoed back', wk.body.period === 'weekly', wk.body.period);
  check('weekly returns rows', wk.body.leaderboard.length > 0, `${wk.body.leaderboard.length}`);
  const bad = await get(sujal, '/api/analytics/leaderboard?category=nonsense');
  check('unknown category falls back to overall', bad.status === 200, `${bad.status}`);

  console.log('\n=== 6. AUTHORIZATION ===');
  const notAdmin = await get(sujal, '/api/analytics/platform');
  check('student blocked from platform analytics', notAdmin.status === 403, `${notAdmin.status}`);

  const other = await get(sujal, `/api/analytics/student/${(await db.query("SELECT id FROM users WHERE email='priya@student.com'")).rows[0].id}`);
  check('student cannot read another student analytics', other.status === 403, `${other.status}`);

  const self = await get(sujal, `/api/analytics/student/${sujalId}`);
  check('student CAN read own analytics', self.status === 200, `${self.status}`);

  const anon = await fetch(`${API}/api/analytics/leaderboard`);
  check('no token -> 401', anon.status === 401, `${anon.status}`);

  console.log('\n=== 7. BLANK NAME FIXED ===');
  const owner = (await get(admin, '/api/analytics/leaderboard?category=overall')).body.leaderboard
    .find(x => x.email === 'xolegend1050@gmail.com');
  check('project owner has a real name now', owner && owner.full_name === 'Sujal Borhade', owner?.full_name);
  const blanks = await db.query("SELECT COUNT(*)::int n FROM profiles WHERE full_name IS NULL OR btrim(full_name)=''");
  check('no blank full_name in the database', blanks.rows[0].n === 0, `${blanks.rows[0].n}`);

  const failed = results.filter(x => !x.p);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.n));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
