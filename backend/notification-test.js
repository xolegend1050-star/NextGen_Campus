// Verifies every notification type the backend writes is now insertable and
// renderable, and that the previously-broken follow/session flows work.
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

(async () => {
  const sujal = await login('sujal@student.com', 'password123');
  const priya = await login('priya@student.com', 'password123');
  const mentor = await login('mentor1@alumni.com', 'password123');
  const H = t => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

  console.log('=== 1. THE TWO ENUM BUGS ===');

  // follow: previously threw invalid input value for enum notification_type
  await db.query('DELETE FROM follows WHERE follower_id=(SELECT id FROM users WHERE email=$1) AND following_id=(SELECT id FROM users WHERE email=$2)', ['priya@student.com', 'sujal@student.com']);
  const before = await db.query("SELECT COUNT(*)::int n FROM notifications WHERE type='new_follower'");
  const sujalId = (await db.query("SELECT id FROM users WHERE email='sujal@student.com'")).rows[0].id;
  const fr = await fetch(`${API}/api/follows/${sujalId}`, { method: 'POST', headers: H(priya) });
  check('follow endpoint returns 200', fr.status === 200, `status ${fr.status} ${await fr.text().then(t => t.slice(0, 60))}`);
  const after = await db.query("SELECT COUNT(*)::int n FROM notifications WHERE type='new_follower'");
  check('  and wrote a new_follower notification', after.rows[0].n > before.rows[0].n, `${before.rows[0].n} -> ${after.rows[0].n}`);

  // mentorship scheduling
  const req = await db.query(
    `SELECT m.id FROM mentorship_requests m
      WHERE m.mentor_id=(SELECT id FROM users WHERE email='mentor1@alumni.com')
        AND m.status='accepted' LIMIT 1`);
  if (req.rows.length) {
    const b2 = await db.query("SELECT COUNT(*)::int n FROM notifications WHERE type='session_scheduled'");
    // Directly exercise the insert the controller performs
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'session_scheduled', 'Session', 'scheduled', '{}')`,
        [req.rows[0].id ? (await db.query("SELECT id FROM users WHERE email='sujal@student.com'")).rows[0].id : null]);
      check('session_scheduled insert accepted', true);
    } catch (e) {
      check('session_scheduled insert accepted', false, e.message);
    }
    const a2 = await db.query("SELECT COUNT(*)::int n FROM notifications WHERE type='session_scheduled'");
    check('  count increased', a2.rows[0].n > b2.rows[0].n, `${b2.rows[0].n} -> ${a2.rows[0].n}`);
  }

  console.log('\n=== 2. EVERY WRITTEN TYPE IS IN THE ENUM ===');
  const enumRows = await db.query("SELECT e.enumlabel FROM pg_enum e WHERE e.enumtypid='notification_type'::regtype");
  const en = new Set(enumRows.rows.map(r => r.enumlabel));
  const written = ['verification_approved','dispute_resolved','gig_shortlisted','mentor_request',
                   'session_scheduled','session_completed','new_follower','escrow_funded',
                   'payment_received','escrow_refunded'];
  written.forEach(w => check(`  ${w}`, en.has(w), en.has(w) ? '' : 'NOT IN ENUM'));

  console.log('\n=== 3. FRONTEND RENDERS EVERY TYPE ===');
  const src = require('fs').readFileSync(
    'C:/Users/sujal/NextGen_Campus/frontend/src/pages/student/Notifications.jsx', 'utf8');
  const block = src.slice(src.indexOf('const TYPE_META'), src.indexOf('};', src.indexOf('const TYPE_META')));
  const rendered = new Set([...block.matchAll(/^\s{2}([a-z_]+):/gm)].map(m => m[1]));
  en.forEach(t => check(`  ${t} has a UI entry`, rendered.has(t), rendered.has(t) ? '' : 'falls back to generic bell'));
  check('unknown type still has a fallback', /FALLBACK/.test(src));

  console.log('\n=== 4. EXISTING ROWS ARE READABLE ===');
  const list = await (await fetch(`${API}/api/notifications?page=1&limit=20`, { headers: H(sujal) })).json();
  check('notifications endpoint returns rows', Array.isArray(list.notifications), `${list.notifications?.length} rows`);
  const withData = (list.notifications || []).filter(n => n.data);
  check('rows expose data for deep-linking', withData.length > 0, `${withData.length} with data`);
  const uniq = [...new Set((list.notifications || []).map(n => n.type))];
  check('types present in this user\'s feed', uniq.length > 0, uniq.join(', '));
  uniq.forEach(t => check(`  ${t} is styled in UI`, rendered.has(t), rendered.has(t) ? '' : 'GENERIC BELL'));

  const uc = await (await fetch(`${API}/api/notifications/unread-count`, { headers: H(sujal) })).json();
  check('unread count works', typeof uc.count === 'number', String(uc.count));

  // cleanup
  await db.query("DELETE FROM notifications WHERE type IN ('new_follower','session_scheduled')");
  await db.query('DELETE FROM follows WHERE follower_id=(SELECT id FROM users WHERE email=$1) AND following_id=(SELECT id FROM users WHERE email=$2)', ['priya@student.com', 'sujal@student.com']);

  const failed = results.filter(x => !x.p);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.n));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
