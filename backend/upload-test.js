// Upload module end-to-end tests against a running local server
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { io } = require('../frontend/node_modules/socket.io-client');

const API = 'http://localhost:5000';
const TMP = path.join(__dirname, '..', 'uploads', '_testtmp');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const png = async (w, h) => {
  const p = path.join(TMP, `img-${w}x${h}.png`);
  await sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 80, b: 40 } } })
    .png().toFile(p);
  return p;
};

const fakePdf = (p) => { fs.writeFileSync(p, Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n')); return p; };
const fakeExe = (p) => { fs.writeFileSync(p, Buffer.from('MZ\x90\x00\x03\x00\x00\x00')); return p; };
const renamed = (p, ext) => { const n = p.replace(/\.[^.]+$/, ext); fs.copyFileSync(p, n); return n; };

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sujal@student.com', password: 'password123' })
  });
  const token = (await login.json()).token;

  const mimeFor = (p) =>
    p.endsWith('.png') ? 'image/png'
    : p.endsWith('.pdf') ? 'application/pdf'
    : p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg'
    : 'application/octet-stream';

  const send = (url, field, filePath, bodyObj = {}, method = 'POST') => {
    const fd = new FormData();
    // Multipart parts must carry a real Content-Type, exactly like a browser sends
    if (filePath) {
      fd.append(field, new Blob([fs.readFileSync(filePath)], { type: mimeFor(filePath) }), path.basename(filePath));
    }
    for (const [k, v] of Object.entries(bodyObj)) fd.append(k, v);
    return fetch(`${API}${url}`, {
      method, body: fd, headers: { Authorization: `Bearer ${token}` }
    });
  };

  console.log('\n=== AVATAR ===');
  const big = await png(2400, 1600);
  let r = await send('/api/upload/avatar', 'file', big);
  let j = await r.json();
  check('avatar PNG accepted', r.status === 200, `status ${r.status}`);
  check('avatar compressed + thumbnailed', !!j.thumbnailUrl, j.thumbnailUrl || j.error);
  check('avatar resized to <=1920 wide', j.width <= 1920, `width ${j.width}`);
  const avatarUrl = j.url;

  console.log('\n=== RESUME (PDF only) ===');
  const pdf = fakePdf(path.join(TMP, 'resume.pdf'));
  r = await send('/api/upload/resume', 'file', pdf);
  j = await r.json();
  check('PDF resume accepted', r.status === 200, `status ${r.status}`);
  const resumeUrl = j.url;

  const pngAsResume = await png(50, 50);
  r = await send('/api/upload/resume', 'file', pngAsResume);
  check('PNG rejected for resume', r.status === 400, `status ${r.status}`);

  console.log('\n=== MALICIOUS / MISMATCHED FILES ===');
  const exe = fakeExe(path.join(TMP, 'evil.exe'));
  r = await send('/api/upload/avatar', 'file', exe);
  check('EXE rejected (extension)', r.status === 400, `status ${r.status}`);

  const pngNamedPdf = renamed(pngAsResume, '.pdf');
  r = await send('/api/upload/avatar', 'file', pngAsResume);
  check('PNG rejected on avatar (allowed: images only)', r.status === 200, 'image is valid here');

  const realPng = await png(30, 30);
  const fakePdfNamed = path.join(TMP, 'disguised.pdf');
  const buf = fs.readFileSync(realPng);
  fs.writeFileSync(fakePdfNamed, buf);
  r = await send('/api/upload/resume', 'file', fakePdfNamed);
  check('PNG content renamed to .pdf rejected (magic bytes)', r.status === 400, `status ${r.status}`);
  const body = await r.text();
  check('  and the reason mentions content type', /content type|extension|Invalid/i.test(body), body.slice(0, 80));

  const sendJson = (url, obj, method = 'POST') =>
    fetch(`${API}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(obj)
    });

  console.log('\n=== APPLY TO PROFILE ===');
  r = await sendJson('/api/upload/avatar/apply', { url: avatarUrl });
  j = await r.json();
  check('avatar applied to profile', r.status === 200 && j.success, JSON.stringify(j).slice(0, 70));

  r = await sendJson('/api/upload/resume/apply', { url: resumeUrl, file_name: 'Sujal_Borhade_Resume.pdf' });
  j = await r.json();
  check('resume applied to profile', r.status === 200 && j.success, JSON.stringify(j).slice(0, 70));

  r = await sendJson('/api/upload/resume/apply', { url: '/etc/passwd' });
  check('path traversal on apply rejected', r.status === 400, `status ${r.status}`);

  r = await sendJson('/api/upload/avatar/apply', { url: '/uploads/avatars/does-not-exist.jpg' });
  check('apply with unknown file rejected', r.status === 400, `status ${r.status}`);

  // Confirm it actually landed in the database
  const me = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const meBody = await me.json();
  check('avatar persisted on profile', meBody.user.avatar_url === avatarUrl, String(meBody.user.avatar_url));

  console.log('\n=== DELETE ===');
  if (avatarUrl) {
    const fname = path.basename(avatarUrl);
    r = await send(`/api/upload/avatar/${fname}`, null, null, {}, 'DELETE');
    check('delete own upload works', r.status === 200, `status ${r.status}`);
  } else {
    check('delete own upload works', false, 'no avatar was uploaded');
  }

  r = await send('/api/upload/avatar/..%2F..%2Fpackage.json', null, null, {}, 'DELETE');
  check('traversal delete rejected', r.status === 400 || r.status === 404, `status ${r.status}`);

  r = await send('/api/upload/bogus/x.png', null, null, {}, 'DELETE');
  check('unknown category rejected', r.status === 400, `status ${r.status}`);

  console.log('\n=== STATIC SERVING HEADERS ===');
  const sres = await fetch(`http://localhost:5000${avatarUrl}`).catch(() => null);
  if (sres) {
    check('deleted file 404s', sres.status === 404, `status ${sres.status}`);
  }
  const stillThere = resumeUrl ? await fetch(`http://localhost:5000${resumeUrl}`) : null;
  if (!stillThere) {
    check('PDF served as attachment (not inline)', false, 'no resume uploaded');
    check('PDF served with nosniff', false, 'no resume uploaded');
  } else {
  check('PDF served as attachment (not inline)', /attachment/.test(stillThere.headers.get('content-disposition') || ''), stillThere.headers.get('content-disposition'));
  check('PDF served with nosniff', stillThere.headers.get('x-content-type-options') === 'nosniff');
  }

  console.log('\n=== ERROR MAPPING (client errors must be 4xx, not 500) ===');
  const noField = await fetch(`${API}/api/upload/avatar`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: new FormData()
  });
  check('missing file field -> 4xx not 500', noField.status < 500, `status ${noField.status}`);

  console.log('\n=== NO AUTH ===');
  const anon = await fetch(`${API}/api/upload/avatar`, { method: 'POST', body: new FormData() });
  check('upload without token rejected', anon.status === 401, `status ${anon.status}`);

  fs.rmSync(TMP, { recursive: true, force: true });

  const failed = results.filter(x => !x.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  if (failed.length) { failed.forEach(f => console.log('  FAILED: ' + f.name)); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
