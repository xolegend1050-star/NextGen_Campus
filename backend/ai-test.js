// AI module tests: timeout enforcement, retry, and graceful degradation
// A stub AI service lets us simulate slow / flaky / dead upstreams.
require('dotenv').config();
const http = require('http');

const PORT = 5099;
const API = 'http://localhost:5000';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

// ---- Stub AI service with switchable behaviour ----
let mode = 'ok';
let hits = 0;
let lastBody = null;

const stub = http.createServer((req, res) => {
  hits++;
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    lastBody = body ? JSON.parse(body) : null;
    if (req.url === '/health') {
      return res.writeHead(mode === 'dead' ? 500 : 200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'healthy' }));
    }
    if (mode === 'dead') {
      return res.destroy();
    }
    if (mode === 'slow') {
      // Never respond: proves the client-side timeout actually fires
      return;
    }
    if (mode === 'flaky') {
      if (hits < 3) return res.writeHead(500).end('boom');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      answer: 'Mock AI answer', mentors: [], gigs: [],
      is_safe: true, questions: 'Q1?', analysis: {}, prediction: {}
    }));
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => stub.listen(PORT, r));
  console.log('Stub AI service on :' + PORT);

  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sujal@student.com', password: 'password123' })
  });
  const token = (await login.json()).token;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const post = (p, b) => fetch(`${API}${p}`, { method: 'POST', headers: H, body: JSON.stringify(b) });

  console.log('\n=== 1. AI HEALTH ===');
  mode = 'ok';
  let r = await fetch(`${API}/api/ai/health`, { headers: { Authorization: `Bearer ${token}` } });
  let j = await r.json();
  check('health reports available', r.status === 200 && j.available === true, JSON.stringify(j).slice(0, 60));

  console.log('\n=== 2. RETRY ON TRANSIENT 5xx ===');
  mode = 'flaky';
  hits = 0;
  const t0 = Date.now();
  // Use an endpoint with no DB prerequisite so the upstream is genuinely hit
  r = await post('/api/ai/mock-interview', { role: 'Developer', skills: ['js'] });
  check('survives flaky upstream (5xx then 200)', r.status === 200, `status ${r.status}, ${hits} upstream hits, ${Date.now() - t0}ms`);
  check('  and actually retried', hits >= 3, `${hits} upstream attempts`);

  console.log('\n=== 3. TIMEOUT ON HUNG UPSTREAM (the hang bug) ===');
  mode = 'slow';
  hits = 0;
  const t1 = Date.now();
  r = await post('/api/ai/mock-interview', { role: 'Developer', skills: ['js'] });
  const elapsed = Date.now() - t1;
  check('request returns instead of hanging forever', !!r.status, `status ${r.status} after ${elapsed}ms`);
  check('timeout is bounded (< 90s)', elapsed < 90000, `${elapsed}ms`);
  check('reports a timeout code', r.status === 504 || r.status === 503, `status ${r.status}`);

  console.log('\n=== 4. DEAD UPSTREAM -> graceful degradation ===');
  mode = 'dead';
  r = await post('/api/ai/moderate-content', { content: 'some user text' });
  j = await r.json();
  check('moderation fails OPEN, not blocking the user', r.status === 200 && j.is_safe === true, JSON.stringify(j).slice(0, 70));
  check('  and is flagged as degraded', j.degraded === true);

  r = await post('/api/ai/analyze-resume', { resume_url: '/uploads/resumes/x.pdf' });
  j = await r.json();
  check('resume analysis returns renderable shape', r.status === 200 && j.analysis && Array.isArray(j.analysis.recommendations), `status ${r.status}`);

  console.log('\n=== 5. VALIDATION ===');
  mode = 'ok';
  r = await post('/api/ai/moderate-content', {});
  check('empty content -> 400', r.status === 400, `status ${r.status}`);
  r = await post('/api/ai/mock-interview', { role: 'Dev' });
  check('missing skills -> 400', r.status === 400, `status ${r.status}`);
  r = await post('/api/ai/draft-answer', { doubt_id: 'not-a-uuid' });
  check('bad uuid -> 400', r.status === 400, `status ${r.status}`);

  console.log('\n=== 6. RECOMMENDERS FALL BACK TO SQL (AI down) ===');
  mode = 'dead';
  r = await fetch(`${API}/api/ai/recommend-mentors`, { headers: { Authorization: `Bearer ${token}` } });
  j = await r.json();
  check('mentors returned from SQL fallback', Array.isArray(j.mentors) && j.mentors.length > 0, `${(j.mentors || []).length} mentors`);
  r = await fetch(`${API}/api/ai/recommend-gigs`, { headers: { Authorization: `Bearer ${token}` } });
  j = await r.json();
  check('gigs returned from SQL fallback', Array.isArray(j.gigs) && j.gigs.length > 0, `${(j.gigs || []).length} gigs`);

  console.log('\n=== 7. NO AUTH ===');
  const anon = await fetch(`${API}/api/ai/recommend-gigs`);
  check('AI endpoint without token -> 401', anon.status === 401, `status ${anon.status}`);

  stub.close();
  const failed = results.filter(x => !x.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.name));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); try { stub.close(); } catch (_) {} process.exit(1); });
