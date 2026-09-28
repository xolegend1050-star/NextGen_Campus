// Verifies the escrow API returns every field the new UI components read.
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
  const co = await login('hr@techstartup.com', 'password123');
  const st = await login('sujal@student.com', 'password123');

  const gig = (await db.query(
    'SELECT id, title, compensation FROM gigs WHERE company_id=(SELECT id FROM users WHERE email=$1) LIMIT 1',
    ['hr@techstartup.com'])).rows[0];

  // Seed a locked escrow exactly as the UI would
  await db.query('DELETE FROM escrow_transactions WHERE gig_id=$1', [gig.id]);
  await db.query(
    `UPDATE gig_applications SET status='accepted'
      WHERE gig_id=$1 AND student_id=(SELECT id FROM users WHERE email='sujal@student.com')`,
    [gig.id]);
  const app = (await db.query(
    `SELECT id FROM gig_applications WHERE gig_id=$1
      AND student_id=(SELECT id FROM users WHERE email='sujal@student.com')`, [gig.id])).rows[0];
  if (!app) { console.log('no application to test with'); process.exit(1); }

  await db.query('UPDATE wallets SET balance=50000 WHERE user_id=(SELECT id FROM users WHERE email=$1)', ['hr@techstartup.com']);
  const fund = await (await fetch(`${API}/api/wallet/escrow/${gig.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${co}` },
    body: JSON.stringify({ application_id: app.id, amount: 2500 })
  })).json();

  console.log('\n=== 1. COMPANY VIEW (EscrowActions) ===');
  const coList = await (await fetch(`${API}/api/wallet/escrow`, { headers: { Authorization: `Bearer ${co}` } })).json();
  const e = coList.escrows?.[0];
  check('company gets a list', Array.isArray(coList.escrows) && coList.escrows.length > 0);
  // EscrowActions/escrowFor read these
  for (const f of ['id', 'application_id', 'student_id', 'amount', 'status', 'gig_title', 'created_at', 'released_at']) {
    check(`  field present: ${f}`, e && f in e, e ? String(e[f]) : 'missing row');
  }
  check('  EscrowBadge status is known', ['locked', 'released', 'refunded'].includes(e.status), e.status);
  check('  gig_title populated for display', !!e.gig_title, e.gig_title);

  console.log('\n=== 2. STUDENT VIEW (Wallet) ===');
  const stList = await (await fetch(`${API}/api/wallet/escrow`, { headers: { Authorization: `Bearer ${st}` } })).json();
  const se = stList.escrows?.[0];
  check('student sees their escrow', Array.isArray(stList.escrows) && stList.escrows.length > 0, `${stList.escrows?.length} rows`);
  for (const f of ['id', 'amount', 'status', 'gig_title', 'company_name', 'released_at']) {
    check(`  field present: ${f}`, se && f in se, se ? String(se[f]) : 'missing');
  }
  check('  held-in-escrow sum computable', parseFloat(se.amount) === 2500, String(se.amount));

  console.log('\n=== 3. FUND RESPONSE SHAPE (onChange) ===');
  check('fund returns escrow object', !!fund.escrow?.id, fund.escrow?.id);
  check('  with application_id', fund.escrow?.application_id === app.id);

  console.log('\n=== 4. RELEASE + REFUND RESPONSES ===');
  const rel = await (await fetch(`${API}/api/wallet/escrow/${gig.id}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${co}` },
    body: JSON.stringify({ force: true })
  })).json();
  check('release returns escrow object', !!rel.escrow?.id, rel.escrow?.status);
  check('  and alreadyReleased flag', rel.alreadyReleased === false || rel.alreadyReleased === true, String(rel.alreadyReleased));
  check('  and a message for the toast', typeof rel.message === 'string', rel.message);

  await db.query('DELETE FROM escrow_transactions WHERE gig_id=$1', [gig.id]);
  await (await fetch(`${API}/api/wallet/escrow/${gig.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${co}` },
    body: JSON.stringify({ application_id: app.id, amount: 100 })
  })).json();
  const ref = await (await fetch(`${API}/api/wallet/escrow/${gig.id}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${co}` },
    body: JSON.stringify({})
  })).json();
  check('refund returns escrow object', !!ref.escrow?.id, ref.escrow?.status);

  // cleanup
  await db.query('DELETE FROM escrow_transactions WHERE gig_id=$1', [gig.id]);
  await db.query('DELETE FROM gig_deliverables WHERE gig_id=$1', [gig.id]);
  await db.query('UPDATE wallets SET balance=50000 WHERE user_id=(SELECT id FROM users WHERE email=$1)', ['hr@techstartup.com']);
  await db.query("UPDATE wallets SET balance=0, total_earned=0 WHERE user_id=(SELECT id FROM users WHERE email='sujal@student.com')");

  const failed = results.filter(x => !x.p);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.n));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
