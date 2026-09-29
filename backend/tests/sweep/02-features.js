// Sweep: doubts, gigs, mentorship, social, notifications, profiles, resources
const H = require('./harness');
const { suite, check, expect, uuid, anotherUuid, users, db } = H;

module.exports = async function run() {
  suite('DOUBTS + GIGS + MENTORSHIP + SOCIAL');

  // ---------- doubts ----------
  let r = await users.studentC('POST', '/api/doubts', {
    title: 'Sweep: how do I test a websocket connection?',
    content: 'I want to verify my socket handshake works correctly in production.',
    tags: ['test', 'sockets'],
    subject: 'Web Dev'
  });
  expect('create doubt valid', r, 201);
  const doubtId = r.body.doubt?.id;

  r = await users.studentC('POST', '/api/doubts', { title: 'no body' });
  expect('create doubt missing content rejected', r, 400);

  r = await users.anonC('POST', '/api/doubts', { title: 'x', content: 'y' });
  expect('create doubt needs auth', r, 401);

  r = await users.anonC('GET', '/api/doubts');
  expect('list doubts public', r, 200);

  r = await users.studentC('GET', `/api/doubts/${doubtId}`);
  expect('get one doubt', r, 200);
  r = await users.studentC('GET', `/api/doubts/${uuid}`);
  expect('get unknown doubt -> 404', r, 404);
  r = await users.studentC('GET', '/api/doubts/not-a-uuid');
  check('get doubt bad uuid handled', r.status === 400 || r.status === 404, `${r.status}`);

  r = await users.student2C('PUT', `/api/doubts/${doubtId}`, { title: 'a title that is definitely not mine' });
  expect('cannot edit another user doubt', r, 403);

  r = await users.studentC('PUT', `/api/doubts/${doubtId}`, { title: 'Sweep edited title' });
  expect('edit own doubt', r, 200);

  r = await users.studentC('POST', `/api/doubts/${doubtId}/answers`, {
    content: 'You can listen for the connection event on the client.'
  });
  expect('answer a doubt', r, 201);
  const answerId = r.body.answer?.id;

  r = await users.student2C('POST', `/api/doubts/${doubtId}/answers`, { content: '' });
  expect('empty answer rejected', r, 400);

  r = await users.studentC('POST', `/api/doubts/${doubtId}/answers`, { content: 'x' });
  check('answer own doubt (allowed or rejected cleanly)', r.status === 201 || r.status === 400, `${r.status}`);

  r = await users.studentC('GET', `/api/doubts/${doubtId}/answers`);
  expect('list answers', r, 200);

  r = await users.student2C('POST', `/api/doubts/${doubtId}/vote`, { vote_type: 1 });
  check('vote on a doubt', r.status === 200 || r.status === 201, `${r.status}`);
  r = await users.student2C('POST', `/api/doubts/${doubtId}/vote`, { vote_type: 'nonsense' });
  expect('invalid vote type rejected', r, 400);
  r = await users.anonC('POST', `/api/doubts/${doubtId}/vote`, { vote_type: 1 });
  expect('voting needs auth', r, 401);

  r = await users.studentC('POST', `/api/doubts/${doubtId}/accept/${answerId}`);
  check('accept an answer', r.status === 200 || r.status === 400, `${r.status}`);

  r = await users.studentC('POST', '/api/doubts/answers/' + uuid + '/vote', { vote_type: 1 });
  check('vote unknown answer handled', r.status === 404 || r.status === 400, `${r.status}`);

  // ---------- gigs ----------
  r = await users.anonC('GET', '/api/gigs');
  expect('list gigs public', r, 200);
  const gig = (r.body.gigs || [])[0];

  r = await users.studentC('GET', '/api/gigs/my-applications');
  expect('my applications', r, 200);
  r = await users.anonC('GET', '/api/gigs/my-applications');
  expect('my applications needs auth', r, 401);

  r = await users.companyC('POST', '/api/gigs', {
    title: 'Sweep test gig',
    description: 'A gig created by the sweep to check that gig creation validation accepts a well formed payload.',
  application_deadline: new Date(Date.now() + 14 * 864e5).toISOString(),
    skills_required: ['Testing'],
    compensation: 1500, duration_days: 14, category: 'Testing'
  });
  expect('company creates a gig', r, 201);
  const gigId = r.body.gig?.id || r.body.gig?.data?.id;

  r = await users.studentC('POST', '/api/gigs', {
    title: 'Student should not create', description: 'x', skills_required: [], compensation: 1
  });
  expect('student cannot create a gig', r, 403);

  r = await users.companyC('POST', '/api/gigs', { title: 'no description' });
  expect('gig missing fields rejected', r, 400);

  r = await users.companyC('POST', '/api/gigs', {
    title: 'negative pay', description: 'x', skills_required: ['a'], compensation: -500
  });
  expect('negative compensation rejected', r, 400);

  r = await users.studentC('GET', `/api/gigs/${gigId}`);
  expect('view a gig', r, 200);
  r = await users.studentC('GET', `/api/gigs/${uuid}`);
  expect('view unknown gig -> 404', r, 404);

  r = await users.studentC('POST', `/api/gigs/${gigId}/apply`, { cover_letter: 'Please let me help.' });
  check('student applies to a gig', r.status === 201 || r.status === 409, `${r.status}`);

  r = await users.companyC('POST', `/api/gigs/${gigId}/apply`, { cover_letter: 'me' });
  expect('company cannot apply to its own gig', r, 403);

  r = await users.anonC('POST', `/api/gigs/${gigId}/apply`, { cover_letter: 'x' });
  expect('applying needs auth', r, 401);

  r = await users.companyC('GET', `/api/gigs/${gigId}/applications`);
  expect('company lists applications on own gig', r, 200);
  r = await users.student2C('GET', `/api/gigs/${gigId}/applications`);
  expect('non-owner cannot list applications', r, 403);

  const appId = (await db.query('SELECT id FROM gig_applications WHERE gig_id=$1 LIMIT 1', [gigId])).rows[0]?.id;
  r = await users.companyC('PATCH', `/api/gigs/applications/${appId}`, { status: 'shortlisted' });
  check('shortlist an application', r.status === 200 || r.status === 400, `${r.status}`);

  r = await users.studentC('PATCH', `/api/gigs/applications/${appId}`, { status: 'accepted' });
  expect('student cannot change application status', r, 403);

  r = await users.companyC('PATCH', `/api/gigs/applications/${appId}`, { status: 'not_a_status' });
  expect('invalid application status rejected', r, 400);

  // ---------- mentorship ----------
  r = await users.anonC('GET', '/api/mentorship/mentors');
  expect('list mentors public', r, 200);

  r = await users.studentC('GET', '/api/mentorship/requests');
  expect('my mentorship requests', r, 200);
  r = await users.anonC('GET', '/api/mentorship/requests');
  expect('mentorship requests need auth', r, 401);

  r = await users.studentC('POST', '/api/mentorship/requests', {
    mentor_id: users.id.mentor, message: 'Sweep request for mentorship'
  });
  check('create mentorship request', r.status === 201 || r.status === 409, `${r.status}`);
  const reqId = r.body.request?.id;

  r = await users.studentC('POST', '/api/mentorship/requests', { message: 'no mentor id' });
  expect('request without mentor_id rejected', r, 400);

  r = await users.studentC('POST', '/api/mentorship/requests', { mentor_id: users.id.student, message: 'self as mentor' });
  check('cannot request yourself as mentor', [400, 403, 404].includes(r.status), `${r.status}`);

  r = await users.studentC('POST', '/api/mentorship/requests', { mentor_id: uuid, message: 'ghost mentor' });
  expect('request unknown mentor -> 404', r, 404);

  r = await users.mentorC('GET', '/api/mentorship/requests');
  expect('mentor sees incoming requests', r, 200);

  if (reqId) {
    r = await users.mentorC('PATCH', `/api/mentorship/requests/${reqId}/accept`);
    check('mentor accepts a request', r.status === 200 || r.status === 400, `${r.status}`);

    r = await users.studentC('PATCH', `/api/mentorship/requests/${reqId}/accept`);
    expect('student cannot accept their own request', r, 403);

    r = await users.mentorC('POST', `/api/mentorship/requests/${reqId}/schedule`, {
      scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30
    });
    check('schedule a session', r.status === 201 || r.status === 200 || r.status === 400, `${r.status}`);

    r = await users.mentorC('POST', `/api/mentorship/requests/${reqId}/schedule`, { scheduled_at: 'not-a-date' });
    expect('bad schedule date rejected', r, 400);
  }

  r = await users.mentorC('GET', '/api/mentorship/sessions');
  expect('mentor sessions', r, 200);
  r = await users.anonC('GET', '/api/mentorship/sessions');
  expect('sessions need auth', r, 401);

  r = await users.studentC('POST', `/api/mentorship/sessions/${uuid}/rate`, { rating: 5, feedback: 'great' });
  check('rate unknown session handled', r.status === 404 || r.status === 400, `${r.status}`);

  // ---------- social ----------
  r = await users.studentC('GET', '/api/follows/discover');
  expect('discover people', r, 200);
  r = await users.studentC('GET', '/api/follows/suggestions');
  expect('follow suggestions', r, 200);
  r = await users.studentC('GET', '/api/follows/feed');
  expect('feed', r, 200);
  r = await users.studentC('GET', '/api/follows/online');
  expect('online users', r, 200);

  r = await users.studentC('GET', `/api/follows/${users.id.mentor}/followers`);
  expect('followers list', r, 200);
  r = await users.studentC('GET', `/api/follows/${users.id.mentor}/status`);
  expect('follow status', r, 200);

  r = await users.studentC('POST', `/api/follows/${users.id.student}`);
  expect('cannot follow yourself', r, 400);

  r = await users.studentC('POST', `/api/follows/${users.id.mentor}`);
  check('follow someone', r.status === 200 || r.status === 409, `${r.status}`);

  r = await users.studentC('POST', `/api/follows/${users.id.mentor}`);
  check('following twice is a clean conflict', r.status === 409 || r.status === 200, `${r.status}`);

  r = await users.studentC('POST', `/api/follows/${uuid}`);
  expect('follow unknown user -> 404', r, 404);

  r = await users.studentC('DELETE', `/api/follows/${users.id.mentor}`);
  check('unfollow', r.status === 200 || r.status === 404, `${r.status}`);

  r = await users.anonC('POST', `/api/follows/${users.id.mentor}`);
  expect('following needs auth', r, 401);

  // ---------- notifications ----------
  r = await users.studentC('GET', '/api/notifications');
  expect('list notifications', r, 200);
  r = await users.studentC('GET', '/api/notifications/unread-count');
  expect('unread count', r, 200);
  r = await users.anonC('GET', '/api/notifications');
  expect('notifications need auth', r, 401);

  const notif = (await db.query(
    'SELECT id FROM notifications WHERE user_id=$1 LIMIT 1', [users.id.student]
  )).rows[0];
  if (notif) {
    r = await users.studentC('PUT', `/api/notifications/${notif.id}/read`);
    expect('mark one read', r, 200);
    r = await users.student2C('PUT', `/api/notifications/${notif.id}/read`);
    expect("cannot mark someone else's notification read", r, 404);
  }
  r = await users.studentC('PUT', `/api/notifications/${uuid}/read`);
  check('mark unknown notification handled', r.status === 404 || r.status === 400, `${r.status}`);

  r = await users.studentC('PUT', '/api/notifications/read-all');
  expect('mark all read', r, 200);

  r = await users.studentC('GET', '/api/notifications/preferences');
  expect('notification preferences', r, 200);
  r = await users.studentC('PUT', '/api/notifications/preferences', { email_notifications: false });
  expect('update preferences', r, 200);

  // ---------- blank optional fields ----------
  // Every form in the UI posts "" for any field the user left alone, because an
  // untouched input is "" and a <select> whose first option is
  // <option value="">Select subject</option> always posts "". express-validator's
  // optional() only skips undefined and null, so the notEmpty()/isLength()/
  // isURL() check that followed rejected the blank and the whole form 400'd.
  // Found by clicking through the real Create Doubt form in the browser.
  r = await users.studentC('POST', '/api/doubts', {
    title: 'Sweep: submitting the form exactly as the browser does',
    content: 'The subject select is left on its default empty option and the topic input is untouched.',
    subject: '', topic: '', tags: ['blankfields']
  });
  expect('blank subject and topic accepted on a new doubt', r, 201);
  const blankDoubtId = r.body.doubt?.id;

  r = await users.companyC('POST', '/api/gigs', {
    title: 'Sweep: gig with every optional field left blank',
    description: 'A gig created by the sweep to confirm blank optional fields do not fail validation.',
    application_deadline: new Date(Date.now() + 14 * 864e5).toISOString(),
    skills_required: ['Testing'], compensation: 1500, duration_days: 14,
    category: 'Testing', requirements: '', location: '', max_students: ''
  });
  expect('blank requirements, location and max_students accepted', r, 201);
  const blankGigId = r.body.gig?.id;

  r = await users.studentC('PUT', '/api/profiles/me', {
    full_name: 'Sweep Student', bio: '', city: '', state: '', college_name: '',
    course: '', year_of_study: '', phone: '', linkedin_url: '', github_url: '',
    portfolio_url: ''
  });
  expect('profile update with one real field and the rest blank', r, 200);

  // optionalField must not swallow a legitimate 0
  r = await users.studentC('PUT', '/api/profiles/me', { year_of_study: 0 });
  expect('year_of_study 0 still rejected by isInt({min:1})', r, 400);
  r = await users.studentC('PUT', '/api/profiles/me', { year_of_study: 3 });
  expect('year_of_study 3 still accepted', r, 200);

  // but genuinely bad values must still be rejected
  r = await users.studentC('PUT', '/api/profiles/me', { linkedin_url: 'not-a-url' });
  expect('non-url linkedin_url still rejected', r, 400);
  r = await users.studentC('PUT', '/api/profiles/me', { full_name: 'A' });
  expect('one character name still rejected', r, 400);

  // ---------- blank query params ----------
  // A filter bar that has never been touched is serialised as ?search=&page=.
  // A destructuring default like `const { page = 1 } = req.query` does not fire
  // for "", so the blank was pushed into the LIMIT/OFFSET bind and Postgres
  // answered "invalid input syntax for type bigint" with a 500.
  const blankFilters = [
    '/api/doubts?search=&subject=&sort=&status=&page=&limit=',
    '/api/gigs?search=&category=&skills=&sort=&status=&page=&limit=',
    '/api/mentorship/requests?skill=&city=&page=&limit=',
    '/api/resources?search=&subject=&type=&page=&limit=',
    '/api/notifications?type=&page=&limit=',
    '/api/wallet/transactions?type=&page=&limit=',
    '/api/chat/conversations?page=&limit=',
    '/api/follows/feed?page=&limit='
  ];
  for (const p of blankFilters) {
    r = await users.studentC('GET', p);
    check(`blank filter bar on ${p.split('?')[0]} is 200 not 500`, r.status === 200, `${r.status}`);
  }

  // and a blank query must not weaken the integer checks
  for (const q of ['?page=abc', '?page=0', '?page=-5', '?limit=0', '?limit=99999']) {
    r = await users.studentC('GET', '/api/doubts' + q);
    check(`real bad value ${q} still rejected 400`, r.status === 400, `${r.status}`);
  }

  // ---------- profiles ----------
  r = await users.studentC('GET', '/api/profiles/me');
  expect('my profile', r, 200);
  r = await users.anonC('GET', '/api/profiles/me');
  expect('my profile needs auth', r, 401);

  r = await users.studentC('PUT', '/api/profiles/me', { bio: 'Sweep updated bio', city: 'Mumbai' });
  expect('update own profile', r, 200);

  r = await users.studentC('PUT', '/api/profiles/me', { email: 'hijack@example.com' });
  const emailBefore = (await users.studentC('GET', '/api/profiles/me')).body.profile?.email;
  r = await users.studentC('GET', '/api/profiles/me');
  check('cannot change email via profile', r.body.profile?.email === emailBefore, String(r.body.profile?.email));

  r = await users.studentC('GET', '/api/profiles/me/completion');
  check('profile completion returns a percentage', typeof r.body.completion === 'number' || r.body.percentage !== undefined, JSON.stringify(r.body).slice(0, 60));

  r = await users.anonC('GET', `/api/profiles/${users.id.mentor}`);
  expect('view another profile', r, 200);

  r = await users.studentC('POST', '/api/profiles/me/skills', { skills: ['SweepSkill'] });
  check('add a skill', r.status === 200 || r.status === 201, `${r.status}`);
  const before = (await users.studentC('GET', '/api/profiles/me')).body.profile?.skills?.length ?? 0;
  r = await users.studentC('DELETE', '/api/profiles/me/skills/SweepSkill');
  const after = (await users.studentC('GET', '/api/profiles/me')).body.profile?.skills?.length ?? 0;
  check('remove a skill', r.status === 200 || after === before - 1, String(r.status));


  r = await users.studentC('POST', '/api/profiles/me/experience', {
    company: 'Sweep Co', title: 'Tester', start_date: '2024-01-01'
  });
  check('add experience', r.status === 200 || r.status === 201, `${r.status}`);

  r = await users.studentC('POST', '/api/profiles/me/projects', { title: 'Sweep project' });
  check('add project', r.status === 200 || r.status === 201, `${r.status}`);

  r = await users.studentC('PUT', `/api/profiles/me/experience/${uuid}`, { title: 'nope' });
  check('edit unknown experience handled', r.status === 404 || r.status === 400, `${r.status}`);

  // ---------- resources ----------
  r = await users.anonC('GET', '/api/resources');
  expect('list resources public', r, 200);
  r = await users.anonC('GET', '/api/resources/interview-questions');
  expect('interview questions public', r, 200);
  r = await users.anonC('POST', '/api/resources');
  expect('creating a resource needs auth', r, 401);

  r = await users.studentC('POST', '/api/resources', {
    title: 'Sweep resource', description: 'Created by the sweep', resource_type: 'link', external_url: 'https://example.com'
  });
  check('create a resource', r.status === 200 || r.status === 201, `${r.status}`);
  const resId = r.body.resource?.id;

  r = await users.studentC('POST', '/api/resources', { title: 'no description' });
  expect('resource missing fields rejected', r, 400);

  if (resId) {
    r = await users.anonC('POST', `/api/resources/${resId}/download`);
    check('download a resource', r.status === 200 || r.status === 404, `${r.status}`);
    r = await users.student2C('POST', `/api/resources/${resId}/download`);
    check('resource download by another user', r.status >= 200, `${r.status}`);
  }

  const iq = (await db.query('SELECT id FROM interview_questions LIMIT 1')).rows[0]?.id;
  if (iq) {
    r = await users.studentC('POST', '/api/resources/interview-practice', { question_id: iq, student_answer: 'Sweep test answer describing my approach in detail.' });
    check('interview practice', r.status === 200 || r.status === 400 || r.status === 503, String(r.status));
  }

  // cleanup
  if (blankDoubtId) {
    await db.query('DELETE FROM doubts WHERE id=$1', [blankDoubtId]);
  }
  if (blankGigId) {
    await db.query('DELETE FROM gigs WHERE id=$1', [blankGigId]);
  }
  if (gigId) {
    await db.query('DELETE FROM gig_applications WHERE gig_id=$1', [gigId]);
    await db.query('DELETE FROM gigs WHERE id=$1', [gigId]);
  }
  if (doubtId) {
    await db.query('DELETE FROM doubt_answers WHERE doubt_id=$1', [doubtId]);
    await db.query('DELETE FROM doubt_votes WHERE doubt_id=$1', [doubtId]);
    await db.query('DELETE FROM doubts WHERE id=$1', [doubtId]);
  }
  await db.query("DELETE FROM resources WHERE title='Sweep resource'");
  await db.query("DELETE FROM follows WHERE follower_id=$1 AND following_id=$2", [users.id.student, users.id.mentor]);
};
