// Chat extras: edit, delete, attachments, group chats
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');
const API = 'http://localhost:5000';

const results = [];
const check = (n, p, d = '') => { results.push({ n, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`); };

const login = async (e, p) => (await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: e, password: p })
})).json()).token;

const H = t => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
const call = (m, p, t, b) => fetch(`${API}${p}`, {
  method: m, headers: H(t), body: b === undefined ? undefined : JSON.stringify(b)
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

(async () => {
  const sujal = await login('sujal@student.com', 'password123');
  const mentor = await login('mentor1@alumni.com', 'password123');
  const priya = await login('priya@student.com', 'password123');
  const sujalId = (await db.query("SELECT id FROM users WHERE email='sujal@student.com'")).rows[0].id;
  const priyaId = (await db.query("SELECT id FROM users WHERE email='priya@student.com'")).rows[0].id;
  const mentorId = (await db.query("SELECT id FROM users WHERE email='mentor1@alumni.com'")).rows[0].id;

  // a conversation with just sujal + mentor
  let c = await call('POST', '/api/chat/conversations', sujal, { participant_id: mentorId, type: 'dm' });
  const convId = c.body.conversation.id;
  await call('POST', `/api/chat/conversations/${convId}/read`, sujal, {});

  console.log('=== 1. EDIT MESSAGE ===');
  let m = await call('POST', `/api/chat/conversations/${convId}/messages`, sujal, { content: 'original text' });
  const mid = m.body.message.id;
  check('message sent', m.status === 201, `${m.status}`);
  check('  is_edited starts false', m.body.message.is_edited === false, String(m.body.message.is_edited));

  m = await call('PATCH', `/api/chat/messages/${mid}`, sujal, { content: 'edited text' });
  check('edit succeeds', m.status === 200, `${m.status} ${m.body.error || ''}`);
  check('  content updated', m.body.message.content === 'edited text', m.body.message.content);
  check('  is_edited flag set', m.body.message.is_edited === true);
  check('  includes room for the socket', m.body.message.room === `conversation_${convId}`, m.body.message.room);

  m = await call('PATCH', `/api/chat/messages/${mid}`, mentor, { content: 'hijack' });
  check("cannot edit someone else's message", m.status === 403, `${m.status} ${m.body.error || ''}`);

  m = await call('PATCH', `/api/chat/messages/${mid}`, sujal, { content: '   ' });
  check('empty edit rejected', m.status === 400, `${m.status}`);

  console.log('\n=== 2. DELETE MESSAGE ===');
  m = await call('DELETE', `/api/chat/messages/${mid}`, sujal, undefined);
  check('delete succeeds', m.status === 200, `${m.status} ${m.body.error || ''}`);
  m = await call('DELETE', `/api/chat/messages/${mid}`, mentor, undefined);
  check("cannot delete someone else's message", m.status === 403, `${m.status}`);
  m = await call('DELETE', `/api/chat/messages/${mid}`, sujal, undefined);
  check('deleting twice rejected', m.status === 400, m.body.error);

  const listed = await call('GET', `/api/chat/conversations/${convId}/messages`, sujal, undefined);
  check('deleted message hidden from the list', !listed.body.messages.some(x => x.id === mid), `${listed.body.messages.length} shown`);
  const row = (await db.query('SELECT is_deleted, content FROM messages WHERE id=$1', [mid])).rows[0];
  check('row soft-deleted with content cleared', row.is_deleted === true && row.content === null, JSON.stringify(row));

  console.log('\n=== 3. EMPTY MESSAGE REJECTED ===');
  m = await call('POST', `/api/chat/conversations/${convId}/messages`, sujal, { content: '   ' });
  check('whitespace-only message -> 400', m.status === 400, m.body.error);

  console.log('\n=== 4. FILE ATTACHMENT ===');
  // real PNG bytes
  const pngBuf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const fd = new FormData();
  fd.append('file', new Blob([pngBuf], { type: 'image/png' }), 'screenshot.png');
  const up = await fetch(`${API}/api/chat/attachment`, { method: 'POST', headers: { Authorization: `Bearer ${sujal}` }, body: fd });
  const upj = await up.json();
  check('upload accepted', up.status === 201, `${up.status} ${upj.error || ''}`);
  check('  url under /uploads/chat/', upj.url?.startsWith('/uploads/chat/'), upj.url);
  check('  original filename preserved', upj.file_name === 'screenshot.png', upj.file_name);

  m = await call('POST', `/api/chat/conversations/${convId}/messages`, sujal, {
    file_url: upj.url, file_name: upj.file_name, file_size: upj.size
  });
  check('message with only a file accepted', m.status === 201, `${m.status} ${m.body.error || ''}`);
  check('  message_type is file', m.body.message.message_type === 'file', m.body.message.message_type);
  check('  attachment url stored', m.body.message.file_url === upj.url);

  m = await call('POST', `/api/chat/conversations/${convId}/messages`, sujal, {
    content: 'here is the file', file_url: upj.url, file_name: upj.file_name
  });
  check('text + file together accepted', m.status === 201, `${m.status}`);

  m = await call('POST', `/api/chat/conversations/${convId}/messages`, sujal, {
    content: 'bad link', file_url: 'https://evil.example.com/x.png'
  });
  check('external url rejected', m.status === 400, m.body.error);

  const exe = new FormData();
  exe.append('file', new Blob([Buffer.from('MZ\x90\x00')], { type: 'application/x-msdownload' }), 'bad.exe');
  const exeRes = await fetch(`${API}/api/chat/attachment`, { method: 'POST', headers: { Authorization: `Bearer ${sujal}` }, body: exe });
  check('executable upload rejected', exeRes.status === 400, `${exeRes.status}`);

  console.log('\n=== 5. GROUP CHAT (3+ people) ===');
  g = await call('POST', '/api/chat/conversations', sujal, { participant_ids: [mentorId, priyaId] });
  check('group created', g.status === 201, `${g.status} ${g.body.error || ''}`);
  const gid = g.body.conversation.id;
  const members = (await db.query('SELECT user_id FROM conversation_participants WHERE conversation_id=$1', [gid])).rows;
  check('  has 3 members', members.length === 3, `${members.length}`);
  check('  type recorded as group', g.body.conversation.type === 'group', g.body.conversation.type);

  m = await call('POST', `/api/chat/conversations/${gid}/messages`, sujal, { content: 'hello group' });
  check('group message sent', m.status === 201, `${m.status}`);

  const priyaView = await call('GET', `/api/chat/conversations/${gid}/messages`, priya, undefined);
  check('all members can read', priyaView.status === 200, `${priyaView.status}`);
  const priyaList = await call('GET', '/api/chat/conversations', priya, undefined);
  const gForPriya = priyaList.body.conversations.find(x => x.id === gid);
  check('group appears for each member', !!gForPriya, gForPriya ? `${gForPriya.participants.length} participants` : 'MISSING');
  check('  with 3 participants listed', gForPriya?.participants.length === 3, `${gForPriya?.participants.length}`);

  g = await call('POST', '/api/chat/conversations', sujal, { participant_ids: [mentorId, priyaId] });
  check('same group reuses the conversation', g.body.existing === true, `existing=${g.body.existing} id=${g.body.conversation.id === gid ? 'same' : 'different'}`);

  g = await call('POST', '/api/chat/conversations', sujal, { participant_ids: [mentorId] });
  check('a different member set is a new conversation', g.body.existing === false || g.body.conversation.id !== gid, `id=${g.body.conversation.id === gid ? 'reused (WRONG)' : 'new'}`);

  const add = await call('POST', `/api/chat/conversations/${gid}/participants`, sujal, { user_id: sujalId });
  check('add existing member is idempotent', add.status === 200, `${add.status}`);
  const addGhost = await call('POST', `/api/chat/conversations/${gid}/participants`, sujal, { user_id: '00000000-0000-0000-0000-000000000000' });
  check('add nonexistent member -> 404', addGhost.status === 404, `${addGhost.status}`);

  console.log('\n=== 6. NON-PARTICIPANT STILL BLOCKED ===');
  const outsider = await call('GET', `/api/chat/conversations/${gid}/messages`, (await login('rahul@student.com', 'password123')), undefined);
  check('outsider cannot read the group', outsider.status === 403, `${outsider.status}`);
  const outsiderSend = await call('POST', `/api/chat/conversations/${gid}/messages`, await login('rahul@student.com', 'password123'), { content: 'let me in' });
  check('outsider cannot post to the group', outsiderSend.status === 403, `${outsiderSend.status}`);

  // cleanup
  for (const id of [convId, gid]) {
    await db.query('DELETE FROM messages WHERE conversation_id=$1', [id]);
    await db.query('DELETE FROM conversations WHERE id=$1', [id]);
  }
  try { fs.unlinkSync(path.join(__dirname, '..', 'uploads', 'chat', path.basename(upj.url))); } catch (_) {}

  const failed = results.filter(x => !x.p);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASSED ===`);
  failed.forEach(f => console.log('  FAILED: ' + f.n));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
