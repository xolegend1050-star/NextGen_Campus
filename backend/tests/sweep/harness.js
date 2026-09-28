/**
 * Shared harness for the full-project sweep.
 *
 * Every suite exercises each endpoint twice: once with a valid request that
 * should succeed, and once with a deliberately wrong one that should be
 * rejected with a 4xx. The point is to find endpoints that either reject
 * valid input or accept invalid input.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const API = process.env.SWEEP_API || 'http://localhost:5000';
const db = require('../../src/config/database');

const state = { results: [], suite: '' };

const suite = (name) => {
  state.suite = name;
  console.log(`\n${'='.repeat(70)}\n${name}\n${'='.repeat(70)}`);
};

const check = (name, pass, detail = '') => {
  state.results.push({ suite: state.suite, name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  ${mark}  ${name}${detail ? `  -> ${detail}` : ''}`);
  return pass;
};

const expect = (name, res, wantStatus, detail = '') =>
  check(
    name,
    res.status === wantStatus,
    `got ${res.status}${res.status !== wantStatus ? ` (wanted ${wantStatus})` : ''}${detail ? ` ${res.body?.error || detail}` : ''}`
  );

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) throw new Error(`login failed for ${email}: ${r.status}`);
  return (await r.json()).token;
};

const client = (token) => async (method, path, body, extraHeaders = {}) => {
  // extraHeaders is applied last so a test can deliberately send a bad token
  const headers = { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let parsed = {};
  try {
    parsed = await r.json();
  } catch (_) {
    parsed = {};
  }
  return { status: r.status, body: parsed };
};

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const anotherUuid = '550e8400-e29b-41d4-a716-446655440099';

const users = {};
const seed = async () => {
  users.admin = await login('admin@nextgencampus.com', 'admin123');
  users.student = await login('sujal@student.com', 'password123');
  users.student2 = await login('priya@student.com', 'password123');
  users.mentor = await login('mentor1@alumni.com', 'password123');
  users.company = await login('hr@techstartup.com', 'password123');

  // Prefix the ids so they cannot clobber the token fields above. An earlier
  // version merged these directly and silently replaced users.student (a JWT)
  // with a UUID, so every authenticated call sent a UUID as its bearer token.
  const ids = await db.query(`
    SELECT
      (SELECT id FROM users WHERE email='sujal@student.com')  AS student,
      (SELECT id FROM users WHERE email='priya@student.com') AS student2,
      (SELECT id FROM users WHERE email='mentor1@alumni.com') AS mentor,
      (SELECT id FROM users WHERE email='hr@techstartup.com') AS id_company
  `);
  users.id = ids.rows[0];
  users.studentC = client(users.student);
  users.student2C = client(users.student2);
  users.mentorC = client(users.mentor);
  users.companyC = client(users.company);
  users.adminC = client(users.admin);
  users.anonC = client(null);
};

const summary = () => {
  const failed = state.results.filter((r) => !r.pass);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL: ${state.results.length - failed.length}/${state.results.length} passed`);
  if (failed.length) {
    console.log(`\n${failed.length} FAILING CHECK(S):`);
    failed.forEach((f) => console.log(`  [${f.suite}] ${f.name}  ${f.detail}`));
  }
  console.log('='.repeat(70));
  return failed;
};

module.exports = { API, db, state, suite, check, expect, login, client, uuid, anotherUuid, users, seed, summary };
