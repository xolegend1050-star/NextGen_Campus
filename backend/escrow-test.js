// Escrow lifecycle: fund -> deliver -> release, plus refund and abuse cases
require('dotenv').config();
const db = require('./src/config/database');
const API = 'http://localhost:5000';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) throw new Error(`login failed for ${email}: ${r.status}`);
  return (await r.json()).token;
};

const api = (token) => async (method, p, body) => {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null;
  try { j = await r.json(); } catch (_) {}
  return { status: r.status, body: j };
};

(async () => {
  const company = await login('hr@techstartup.com', 'password123');
  const student = await login('sujal@student.com', 'password123');
  const other = await login('priya@student.com', 'password123');
  const C = api(company), S = api(student), O = api(other);

  // Find one of this company's gigs
  const gigsRes = await C('GET', '/api/gigs/my-gigs');
  let gig = (gigsRes.body?.gigs || gigsRes.body || [])[0];
  if (!gig) {
    // fall back to any open gig owned by the company
    const q = await db.query('SELECT id, title FROM gigs WHERE company_id=(SELECT id FROM users WHERE email=$1) LIMIT 1', ['hr@techstartup.com']);
    gig = q.rows[0];
  }
  if (!gig) { console.log('no company gig found, cannot test'); process.exit(1); }
  console.log(`gig: ${gig.title} (${gig.id})`);

  // Ensure an accepted application from the student exists
  await db.query(
    `INSERT INTO gig_applications (gig_id, student_id, status)
     VALUES ($1, $2, 'accepted')
     ON CONFLICT (gig_id, student_id) DO UPDATE SET status='accepted', accepted_at=NOW()`,
    [gig.id, (await db.query('SELECT id FROM users WHERE email=$1', ['sujal@student.com'])).rows[0].id]
  );
  const app = (await db.query(
    `SELECT id, student_id, status FROM gig_applications
      WHERE gig_id=$1 AND student_id=(SELECT id FROM users WHERE email='sujal@student.com')`,
    [gig.id]
  )).rows[0];
  console.log(`application: ${app.id} status=${app.status}`);

  // Clear any prior escrow + deliverable for a clean run
  await db.query("DELETE FROM escrow_transactions WHERE gig_id=$1 AND application_id=$2", [gig.id, app.id]);
  await db.query('DELETE FROM gig_deliverables WHERE gig_id=$1 AND student_id=$2', [gig.id, app.student_id]);

  const bal = async (email) => parseFloat((await db.query(
    'SELECT balance FROM wallets WHERE user_id=(SELECT id FROM users WHERE email=$1)', [email]
  )).rows[0].balance);

  console.log('\n=== 1. VALIDATION ===');
  let r = await C('POST', `/api/wallet/escrow/${gig.id}`, {});
  check('missing application_id -> 400', r.status === 400, r.body?.error);

  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: -500 });
  check('NEGATIVE amount rejected', r.status === 400, r.body?.error);

  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 0 });
  check('zero amount rejected', r.status === 400, r.body?.error);

  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 'abc' });
  check('non-numeric amount rejected', r.status === 400, r.body?.error);

  console.log('\n=== 2. AUTHORIZATION ===');
  r = await S('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 500 });
  check('student cannot fund escrow', r.status === 403, `status ${r.status}`);

  const pendingApp = (await db.query(
    `INSERT INTO gig_applications (gig_id, student_id, status) VALUES ($1,$2,'pending')
     ON CONFLICT (gig_id, student_id) DO UPDATE SET status='pending' RETURNING id`,
    [gig.id, (await db.query('SELECT id FROM users WHERE email=$1', ['priya@student.com'])).rows[0].id]
  )).rows[0];
  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: pendingApp.id, amount: 500 });
  check('pending applicant cannot be funded', r.status === 400, r.body?.error);
  await db.query('DELETE FROM gig_applications WHERE id=$1', [pendingApp.id]);

  console.log('\n=== 3. FUND ESCROW ===');
  await db.query('UPDATE wallets SET balance = 50000 WHERE user_id=(SELECT id FROM users WHERE email=$1)', ['hr@techstartup.com']);
  const coBefore = await bal('hr@techstartup.com');
  const stBefore = await bal('sujal@student.com');

  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 2000 });
  check('escrow funded', r.status === 201, `${r.status} ${r.body?.error || ''}`);
  const escrow = r.body?.escrow;
  check('  student_id recorded (the old bug)', !!escrow?.student_id, String(escrow?.student_id));
  check('  application_id recorded', !!escrow?.application_id);
  check('  status locked', escrow?.status === 'locked');

  const coAfterFund = await bal('hr@techstartup.com');
  check('company balance debited by exactly 2000', coBefore - coAfterFund === 2000, `${coBefore} -> ${coAfterFund}`);
  check('student balance unchanged while in escrow', (await bal('sujal@student.com')) === stBefore);

  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 500 });
  check('double funding rejected (409)', r.status === 409, `${r.status} ${r.body?.error}`);

  console.log('\n=== 4. RELEASE BLOCKED WITHOUT WORK ===');
  r = await C('POST', `/api/wallet/escrow/${gig.id}/release`, {});
  check('release blocked with no deliverable', r.status === 400, r.body?.error);

  console.log('\n=== 5. SUBMIT WORK, THEN RELEASE ===');
  await db.query(
    'INSERT INTO gig_deliverables (gig_id, student_id, title, description, status) VALUES ($1,$2,$3,$4,$5)',
    [gig.id, app.student_id, 'Final deliverable', 'Completed work', 'submitted']
  );
  r = await C('POST', `/api/wallet/escrow/${gig.id}/release`, {});
  check('release succeeds after work submitted', r.status === 200, `${r.status} ${r.body?.error || ''}`);

  const stAfter = await bal('sujal@student.com');
  check('student credited exactly 2000', stAfter - stBefore === 2000, `${stBefore} -> ${stAfter}`);

  r = await C('POST', `/api/wallet/escrow/${gig.id}/release`, {});
  check('repeat release is idempotent', r.body?.alreadyReleased === true, JSON.stringify(r.body).slice(0, 60));
  check('  and does not pay twice', (await bal('sujal@student.com')) === stAfter);

  console.log('\n=== 6. REFUND PATH ===');
  await db.query('DELETE FROM escrow_transactions WHERE gig_id=$1 AND application_id=$2', [gig.id, app.id]);
  const stBeforeRefund = await bal('sujal@student.com');
  const coBeforeFund2 = await bal('hr@techstartup.com');
  r = await C('POST', `/api/wallet/escrow/${gig.id}`, { application_id: app.id, amount: 1500 });
  check('re-funded for refund test', r.status === 201);
  const coAfterFund2 = await bal('hr@techstartup.com');
  check('  debited 1500', coBeforeFund2 - coAfterFund2 === 1500, `${coBeforeFund2} -> ${coAfterFund2}`);

  r = await C('POST', `/api/wallet/escrow/${gig.id}/refund`, { reason: 'Gig cancelled' });
  check('refund succeeds', r.status === 200, `${r.status} ${r.body?.error || ''}`);
  const coAfterRefund = await bal('hr@techstartup.com');
  check('  company got the 1500 back', coAfterRefund - coAfterFund2 === 1500, `${coAfterFund2} -> ${coAfterRefund}`);
  check('  company is back to its pre-funding balance', coAfterRefund === coBeforeFund2, `${coBeforeFund2} vs ${coAfterRefund}`);
  check('  student did NOT get paid', (await bal('sujal@student.com')) === stBeforeRefund);
  r = await C('POST', `/api/wallet/escrow/${gig.id}/release`, { force: true });
  check('refunded escrow cannot be released', r.status === 400, r.body?.error);

  console.log('\n=== 7. LISTING + ISOLATION ===');
  r = await C('GET', '/api/wallet/escrow');
  check('company can list its escrows', Array.isArray(r.body?.escrows) && r.body.escrows.length > 0, `${r.body?.escrows?.length} rows`);
  r = await S('GET', '/api/wallet/escrow');
  check('student sees own escrow history', Array.isArray(r.body?.escrows) && r.body.escrows.length > 0, `${r.body?.escrows?.length} rows`);
  const anon = await fetch(`${API}/api/wallet/escrow`);
  check('listing without token -> 401', anon.status === 401);

  // cleanup
  await db.query('DELETE FROM escrow_transactions WHERE gig_id=$1 AND application_id=$2', [gig.id, app.id]);
  await db.query('DELETE FROM gig_deliverables WHERE gig_id=$1 AND student_id=$2', [gig.id, app.student_id]);

  const failed = results.filter(x => !x.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.name));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
