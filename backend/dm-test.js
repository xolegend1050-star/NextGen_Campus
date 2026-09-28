// Read receipts + DM: participants, unread counts, authorization
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
const put = (t, p) => fetch(`${API}${p}`, { method: 'PUT', headers: H(t) }).then(async r => ({ status: r.status, body: await r.json() }));
const post = (t, p, b) => fetch(`${API}${p}`, { method: 'POST', headers: H(t), body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.json() }));

(async () => {
  const sujal = await login('sujal@student.com', 'password123');
  const mentor = await login('mentor1@alumni.com', 'password123');
  const priya = await login('priya@student.com', 'password123');
  const sujalId = (await db.query("SELECT id FROM users WHERE email='sujal@student.com'")).rows[0].id;

  console.log('=== 1. PARTICIPANTS (was: only yourself) ===');
  let r = await get(sujal, '/api/chat/conversations');
  const conv = r.body.conversations[0];
  check('conversation list returns rows', r.body.conversations.length > 0, `${r.body.conversations.length}`);
  check('participants has MORE THAN ONE entry', conv.participants.length > 1, `${conv.participants.length} entries`);
  check('  includes the other person', conv.participants.some(p => p.id !== sujalId), JSON.stringify(conv.participants.map(p => p.full_name)));
  check('  each has a full_name', conv.participants.every(p => !!p.full_name), JSON.stringify(conv.participants.map(p => p.full_name)));

  console.log('\n=== 2. UNREAD BEFORE / AFTER OPENING ===');
  const before = (await get(sujal, '/api/chat/conversations')).body.conversations
    .find(c => c.id === conv.id).unread_count;
  const beforeTotal = (await get(sujal, '/api/chat/unread-count')).body.count;
  console.log(`  unread in conversation: ${before}, global: ${beforeTotal}`);

  r = await get(sujal, `/api/chat/conversations/${conv.id}/messages`);
  check('getMessages returns 200', r.status === 200, `${r.status}`);

  const after = (await get(sujal, '/api/chat/conversations')).body.conversations
    .find(c => c.id === conv.id).unread_count;
  check('opening the conversation CLEARS the unread count', after === 0, `${before} -> ${after}`);

  const msgs = r.body.messages;
  check('returned messages carry read_by', msgs.every(m => Array.isArray(m.read_by)), 'ok');
  check('  and include me once read', msgs.filter(m => m.sender_id !== sujalId).every(m => m.read_by.includes(sujalId)), 'ok');

  console.log('\n=== 3. THE OTHER SIDE SEES RECEIPTS ===');
  const mentorConv = (await get(mentor, '/api/chat/conversations')).body.conversations
    .find(c => c.id === conv.id);
  if (mentorConv) {
    const unreadAfterSujalRead = (await get(mentor, '/api/chat/unread-count')).body.count;
    console.log(`  mentor global unread now: ${unreadAfterSujalRead}`);
  }

  console.log('\n=== 4. GLOBAL UNREAD COUNT ===');
  const total = await get(sujal, '/api/chat/unread-count');
  check('unread-count endpoint works', total.status === 200 && typeof total.body.count === 'number', `${total.body.count}`);
  check('  is zero after reading everything', total.body.count === 0, `${total.body.count}`);

  console.log('\n=== 5. MARK-AS-READ AUTHORIZATION ===');
  // priya is not in this conversation
  const stranger = await put(priya, `/api/chat/conversations/${conv.id}/read`);
  check('non-participant cannot mark a conversation read', stranger.status === 403, `${stranger.status} ${stranger.body?.error || ''}`);

  if (msgs.length) {
    const ownMsg = await put(priya, `/api/chat/messages/${msgs[0].id}/read`);
    check('non-participant cannot mark a single message read', ownMsg.status === 403, `${ownMsg.status} ${ownMsg.body?.error || ''}`);
  }

  const missing = await put(sujal, '/api/chat/messages/00000000-0000-0000-0000-000000000000/read');
  check('unknown message -> 404', missing.status === 404, `${missing.status}`);

  console.log('\n=== 6. CREATE CONVERSATION VALIDATION ===');
  let c = await post(sujal, '/api/chat/conversations', { participant_id: sujalId, type: 'dm' });
  check('cannot DM yourself', c.status === 400, `${c.status} ${c.body?.error || ''}`);

  c = await post(sujal, '/api/chat/conversations', { type: 'dm' });
  check('missing participant_id -> 400', c.status === 400, `${c.status}`);

  c = await post(sujal, '/api/chat/conversations', { participant_id: '00000000-0000-0000-0000-000000000000', type: 'dm' });
  check('nonexistent participant -> 404', c.status === 404, `${c.status} ${c.body?.error || ''}`);

  console.log('\n=== 7. REAL DM ROUND TRIP ===');
  const mentorId = (await db.query("SELECT id FROM users WHERE email='mentor1@alumni.com'")).rows[0].id;
  c = await post(sujal, '/api/chat/conversations', { participant_id: mentorId, type: 'dm' });
  check('DM conversation created or reused', c.status === 200 || c.status === 201, `${c.status} existing=${c.body?.existing}`);
  const dmId = c.body.conversation.id;

  const sent = await post(sujal, `/api/chat/conversations/${dmId}/messages`, { content: 'read receipt test', message_type: 'text' });
  check('message sent', sent.status === 201, `${sent.status}`);

  const mentorList = await get(mentor, '/api/chat/conversations');
  const dmForMentor = mentorList.body.conversations.find(x => x.id === dmId);
  check('new DM appears for the recipient', !!dmForMentor, dmForMentor ? 'found' : 'MISSING');
  check('  with unread_count 1', dmForMentor?.unread_count === 1, `${dmForMentor?.unread_count}`);
  check('  and 2 participants', dmForMentor?.participants.length === 2, `${dmForMentor?.participants.length}`);

  const mentorTotalBefore = (await get(mentor, '/api/chat/unread-count')).body.count;
  check('recipient global unread incremented', mentorTotalBefore >= 1, `${mentorTotalBefore}`);

  await get(mentor, `/api/chat/conversations/${dmId}/messages`);
  const mentorTotalAfter = (await get(mentor, '/api/chat/unread-count')).body.count;
  check('recipient unread cleared after opening', mentorTotalAfter === mentorTotalBefore - 1, `${mentorTotalBefore} -> ${mentorTotalAfter}`);

  // cleanup the test DM
  await db.query('DELETE FROM messages WHERE conversation_id = $1', [dmId]);
  await db.query('DELETE FROM conversations WHERE id = $1', [dmId]);

  const failed = results.filter(x => !x.p);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.n));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.stack); process.exit(1); });
