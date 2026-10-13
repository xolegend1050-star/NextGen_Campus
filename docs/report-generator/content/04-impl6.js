/**
 * Chapter 6: Implementation.
 *
 * Each module is presented in the same shape: what it is for, the code that does
 * the part that matters, and an explanation of why that code is written the way it
 * is. The explanations are not restatements of the listing; they exist to record the
 * reasoning that a reader would otherwise have to reverse-engineer, and in several
 * cases to record a defect that was found and fixed, with the fix visible next to
 * the original problem.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  // =====================================================================
  h1('6', 'Implementation');
  mark('h1:6');

  h2('6.1', 'Development Environment');
  body('The implementation is JavaScript throughout. One language on both sides of the ' +
    'wire means a validation rule, a date format and a string comparison cannot drift ' +
    'between the client and the server, which was a recurring source of defects before ' +
    'the choice was made.')

  table(['Concern', 'Choice', 'Reason'], [
    ['Language', 'JavaScript on client and server',
      'One language across the wire. Table 5.1 gives the full stack with the ' +
      'reasoning for each choice.'],
    ['Server framework', 'Express',
      'Its middleware model is what the route-boundary validation design in ' +
      'section 4.2 depends on.'],
    ['Database', 'PostgreSQL 16',
      'Transactions, row locks and check constraints, because this system moves money.'],
    ['Client', 'React with Vite and React Router',
      'Mostly lists and forms across similar screens; Vite keeps the edit and ' +
      'reload loop short.'],
    ['Client state and forms', 'Zustand, React Hook Form with Zod',
      'One store; validation declared once and enforced on both sides.'],
    ['Real-time', 'Socket.IO', 'Reconnection with backoff is handled for us.'],
    ['Testing', 'Jest with Supertest, plus a three-file endpoint sweep',
      'Supertest drives the real middleware chain rather than a copy of it.']
  ], [20, 30, 50], { caption: 'Table 6.1  The stack in brief' });

  body('The thread remains browsable and searchable after acceptance, which was one of ' +
    'the four gaps from Chapter 2. The reason to keep it is that the next student with ' +
    'the same doubt should find it, and the search is over the subject and body of both ' +
    'questions and answers.')

  h2('6.4', 'Mentorship Module');
  body('The mentorship module is the core of the platform and the reason it exists. A ' +
    'mentor declares availability as a weekly schedule of time slots. A student requests ' +
    'a session with a mentor, naming a topic and a preferred slot. The mentor accepts, ' +
    'declines, or proposes a different time, which returns the request to the student. ' +
    'When a session is held, both parties mark it complete, and once both have, the ' +
    'student rates it.')

  table(['State', 'Meaning', 'Who may change it'], [
    ['requested', 'A student has asked for a session', 'Mentor accepts, declines, or proposes a time'],
    ['scheduled', 'Both parties know when it happens', 'Either party may cancel before completion'],
    ['completed', 'Both parties have marked it held', 'Nobody; the state is terminal'],
    ['cancelled', 'It will not happen', 'Terminal'],
    ['declined', 'The mentor declined', 'Terminal']
  ], [18, 40, 42], { caption: 'Table 6.2  Mentorship session states' });

  body('Completion requiring both parties is deliberate. If one party could complete a ' +
    'session alone, a mentor could mark a session held that never happened and collect the ' +
    'rating; if the student could, a student could manufacture a rating for a mentor who ' +
    'never helped them. Requiring agreement means the rating is attached to something ' +
    'both sides agree happened.')

  note('Mentorship is unpaid, and this is a decision rather than an omission',
    'There is no payment path for mentors, and the rating and trust systems are fully ' +
      'implemented around sessions that carry no money. This was discussed and the ' +
      'decision was to keep it unpaid, because a platform that pays individuals for ' +
      'advice taken by a college has obligations it cannot discharge. The schema records ' +
      'a session with both a student and a mentor and nothing about payment, so adding a ' +
      'fee later would be an addition to the record rather than a change to it.');

  h2('6.5', 'Gigs and Applications Module');
  body('A gig is posted by a company with a title, description, budget, required skills ' +
    'and a deadline. A student applies with a short note. The company reviews the ' +
    'applicants and accepts or rejects each. A company may accept more than one student ' +
    'for one gig, and that fact drives most of the escrow complexity in 6.6.')

  table(['Application state', 'Meaning', 'May the company fund escrow?'], [
    ['pending', 'Submitted, not yet reviewed', 'No'],
    ['accepted', 'Chosen for the work', 'Yes, and this is the only state that may be funded'],
    ['rejected', 'Not chosen', 'No'],
    ['withdrawn', 'The student withdrew', 'No'],
    ['completed', 'Work delivered and paid', 'No; the escrow already exists']
  ], [24, 40, 36], { caption: 'Table 6.3  Application states' });

  body('Funding is restricted to accepted applications for a reason that is only visible ' +
    'in the data model. If escrow could be funded against a pending application, there ' +
    'would be no commitment to pay anyone, and the student would have no relationship to ' +
    'the money. An accepted application is the record that the company intends to work ' +
    'with a particular student, and it is what the escrow points at.')

  h3('Trust tiers');
  body('Trust is derived from activity, never from anything the user submits about ' +
    'themselves. The computation is a single pure function so that the same history ' +
    'always produces the same tier, which matters because the tier is displayed in ' +
    'several places and any disagreement between them would be visible.')

  table(['Tier', 'How it is reached'], [
    ['Newcomer', 'Registered, no qualifying activity yet'],
    ['Contributor', 'At least one answer accepted, or one resource approved, or one completed session rated'],
    ['Trusted', 'A sustained combination: several accepted answers or sessions, and no unresolved dispute'],
    ['Established', 'High volume of completed, rated work across more than one counterparty']
  ], [20, 80], { caption: 'Table 6.4  Trust tiers and how they are reached' });

  h2('6.6', 'Payments and Escrow Module');
  body('This is the module in which correctness matters most, and it is where most of the ' +
    'defects found during the project were found. Four separate faults were repaired here, ' +
    'and each is presented with the fault, because a reader evaluating this work should ' +
    'know both what the system does now and what it was doing wrong before.')

  h3('Fault one: escrow funding lost the money')
  body('Funding an escrow decremented the company available balance but did not raise the ' +
    'locked balance. The money had not left the platform, but the company wallet reported ' +
    'the same locked figure afterwards, so balance plus locked balance no longer equalled ' +
    'the funds the platform held for that company. The wallet was not a truthful statement ' +
    'of anything.')

  code([
    '// The money leaves "available" and becomes "locked" at the same moment.',
    '//',
    '// Only the available side was being decremented, so a company that funded',
    '// escrow saw the amount simply disappear: its wallet reported the same',
    '// locked_balance afterwards, and balance + locked_balance no longer',
    '// equalled the funds it actually held. requestWithdrawal has always moved',
    '// both sides together, and escrow must do the same or the wallet is not a',
    '// truthful statement of what the company owns.',
    'await client.query(',
    '  \'UPDATE wallets SET balance = $1, locked_balance = locked_balance + $2 WHERE id = $3\',',
    '  [balanceAfter, value, wallet.rows[0].id]',
    ');'
  ], { caption: 'Listing 6.2  Funding escrow, with the locked balance raised' });

  h3('Fault two: only the newest applicant could ever be paid')
  body('Releasing escrow selected the transaction to pay with an ordering by creation ' +
    'time and a limit of one, taking whichever was newest. A gig with three accepted ' +
    'students therefore had exactly one payable applicant, and no way to choose which. ' +
    'The company had no control over who received its money.')

  code([
    '// A gig can have several accepted applicants, each with its own escrow.',
    '// Selecting the newest one unconditionally meant a company could only ever',
    '// pay the most recent applicant, with no way to name anyone else, so',
    '// application_id is honoured when supplied.',
    'const escrow = await client.query(',
    '  applicationId',
    '    ? `SELECT * FROM escrow_transactions',
    '        WHERE gig_id = $1 AND company_id = $2 AND application_id = $3',
    '        FOR UPDATE`',
    '    : `SELECT * FROM escrow_transactions',
    '        WHERE gig_id = $1 AND company_id = $2',
    '        ORDER BY created_at DESC LIMIT 1',
    '        FOR UPDATE`,',
    '  applicationId ? [gigId, req.user.id, applicationId] : [gigId, req.user.id]',
    ');'
  ], { caption: 'Listing 6.3  Releasing a named application' });

  h3('Fault three: the protection could be switched off by the party it protected against')
  body('Release required a submitted deliverable. The same endpoint also accepted a flag ' +
    'that skipped the check, and the check for the flag ran before the check for the ' +
    'role, so the paying company could pass it. The gate existed to stop a company paying ' +
    'out for work that was never delivered, and the company could turn it off.')

  code([
    '// Require a submitted deliverable so funds cannot be paid out for nothing.',
    '//',
    '// The check protects the student, so the company paying out must not be',
    '// able to switch it off: force is honoured only for an admin, who is not a',
    '// party to the gig. A company that passes force is refused rather than',
    '// silently overridden.',
    'if (force) {',
    '  if (req.user.role !== \'admin\') {',
    '    const err = new Error(',
    '      \'Only an administrator can release escrow without submitted work\');',
    '    err.status = 403;',
    '    throw err;',
    '  }',
    '  logger.warn(`Admin ${req.user.id} force released escrow ${row.id} ` +',
    '    `for gig ${gigId} with no deliverable`);',
    '}'
  ], { caption: 'Listing 6.4  The deliverable gate, and who may bypass it' });

  note('Why the bypass was restricted rather than removed',
    'An administrator override is sometimes necessary: a student may have delivered work ' +
      'by an agreed route the system did not capture, or a gig may have been agreed ' +
      'off-platform entirely. Removing the override would make those cases unresolvable ' +
      'and would push the decision into a support channel with no record. Restricting it ' +
      'keeps the override available, makes the exception rare, and makes it visible ' +
      'because it is logged with the acting administrator.');

  h3('Fault four: no route wrote the deliverable')
  body('The gate above was implemented and functioning, but the table it read had nothing ' +
    'to read. No route inserted into the deliverable table, so the check always found no ' +
    'deliverable, and no company could ever release escrow normally. A control that can ' +
    'only ever fail closed is not a control, it is an outage. The submission route was ' +
    'added as part of the fix, and is the reason the student side of the escrow flow has ' +
    'a user interface at all.')

  h3('Idempotency and the transaction boundary')
  body('The release path re-reads the escrow row with a row lock inside the transaction, ' +
    'checks its state, and returns without acting if it is already released. Two ' +
    'concurrent releases therefore produce one payment: the second waits for the lock, ' +
    'then sees a terminal state. The same pattern is used in the refund path and in the ' +
    'automatic release described in 6.12.')

  table(['Situation', 'Response', 'Why'], [
    ['Released, released again', '200 with the existing record, marked already released',
      'At-most-once payment without failing a retry'],
    ['Refunded, release attempted', '400', 'A refunded escrow cannot also be released'],
    ['Any other state', '400 naming the current state', 'The caller is told what is wrong'],
    ['No escrow for this gig and company', '404', 'Distinguishes absence from conflict'],
    ['force without admin role', '403', 'The gate is not the payer to operate']
  ], [26, 36, 38], { caption: 'Table 6.5  Release path outcomes' });

  h3('Withdrawals')
  body('A withdrawal request moves the amount from available into locked on the company ' +
    'wallet immediately, so the money cannot be spent twice while an administrator ' +
    'reviews it. Approving the request releases the hold and records the withdrawal; ' +
    'rejecting it returns the money to the available balance. There was no route to ' +
    'complete either half of this, so every request stayed pending forever and the hold ' +
    'was permanent. The administrator list and decision endpoints were added, and are ' +
    'the last of the four escrow defects.')

  code([
    '/**',
    ' * Approving releases the hold only, because the money leaves the platform',
    ' * when the transfer is made outside it. Rejecting returns the money to the',
    ' * available balance, so the hold must be dropped in both cases but the',
    ' * balance only moves in one of them.',
    ' */',
    'SELECT id, balance, locked_balance FROM wallets WHERE id = $1 FOR UPDATE',
    '...',
    'if (decision === \'approve\') {',
    '  await client.query(',
    '    `UPDATE wallets',
    '        SET locked_balance = GREATEST(locked_balance - $1, 0),',
    '            total_withdrawn = total_withdrawn + $1',
    '      WHERE id = $2`,',
    '    [amount, walletId]',
    '  );',
    '} else {',
    '  await client.query(',
    '    `UPDATE wallets',
    '        SET balance = balance + $1,',
    '            locked_balance = GREATEST(locked_balance - $1, 0)',
    '      WHERE id = $2`,',
    '    [amount, walletId]',
    '  );',
    '}'
  ], { caption: 'Listing 6.5  Approving and rejecting a withdrawal' });

  h2('6.7', 'Messaging Module');
  body('Messaging is one-to-one threads plus a connection to a gig or a session. ' +
    'Delivery is over WebSocket on the same process that serves the API, for the reasons ' +
    'given in section 3.5.')

  bullets([
    { text: 'A thread belongs either to a gig or to a mentorship session, so a ' +
      'conversation is always attached to something that happened.' },
    { text: 'The message list is paginated and read from the database on demand rather ' +
      'than buffered in memory, so a service sleep loses nothing.' },
    { text: 'The client reconnects with backoff and, on reconnecting, re-fetches the ' +
      'thread rather than assuming that a frame it did not receive was never sent.' },
    { text: 'Delivery failure is reported to the sender. A message that could not be sent ' +
      'is never shown as sent.' }
  ]);

  note('The reconnection rule is the whole design',
    'Because the socket lives in the same process as the API and the host sleeps when ' +
      'idle, disconnection is normal rather than exceptional. A client that treated a ' +
      'disconnection as an error would show the user an error every time they returned to ' +
      'an idle site. Treating it as ordinary, and re-fetching on return, means the ' +
      'behaviour users see is the same whether the service was awake or asleep.');

  h2('6.8', 'Notifications Module');
  body('Notifications are rows, not a delivery system. An event writes a row and, if the ' +
    'user is connected, pushes it over the socket. A user who was offline sees it on their ' +
    'next visit. This is the right trade at this scale because it needs no delivery ' +
    'guarantee from a third party and cannot lose a notification, which a push service ' +
    'can.')

  h3('A trigger that nothing set')
  body('The notification table carries a last-seen or read timestamp. The application was ' +
    'setting it, but a read that happened through any other path left it stale. It is now ' +
    'maintained by a database trigger, so it is correct however the row was written. This ' +
    'is the same principle as the update timestamps described in section 4.3: if a value ' +
    'is derived from the row, the row should be responsible for it.')

  h2('6.9', 'AI Service');
  body('The AI module provides assistance with a doubt: a student may ask for a hint or an ' +
    'explanation, and the service returns a response that is clearly labelled as generated ' +
    'and is not stored as an accepted answer. Two decisions are worth stating.')

  bullets([
    { text: 'Generated text is never written into the questions or answers tables. It is ' +
      'returned for the student to read and then discarded, so no generated text can ' +
      'later be cited as an accepted answer or contribute to a trust tier.' },
    { text: 'The call is made to an external provider, so it is wrapped in its own timeout ' +
      'and its own error handler. A slow provider makes that one request fail; it does not ' +
      'hold a connection from the pool or delay other requests.' }
  ]);

  h2('6.10', 'Admin and Moderation Module');
  body('The administrative module carries verification review, resource approval, doubt ' +
    'and answer moderation, the audit log, analytics, withdrawal decisions and the escrow ' +
    'override. It is the only module whose routes are all administrative, which means the ' +
    'role check is declared once on the router rather than on each route.')

  table(['Action', 'Effect', 'Recorded'], [
    ['Approve or reject a verification', 'Moves the user between unverified, pending and verified',
      'Audit log with the reason'],
    ['Approve or reject a resource', 'Controls whether it appears in the public library',
      'Audit log'],
    ['Remove a doubt or an answer', 'Hides the content without deleting the thread',
      'Audit log'],
    ['Approve or reject a withdrawal', 'Releases the hold, or returns the money',
      'Audit log and a wallet transaction'],
    ['Release or refund escrow without a deliverable', 'Pays or returns the money',
      'Audit log and a warning line in the application log']
  ], [30, 40, 30], { caption: 'Table 6.6  Administrative actions and their records' });

  body('The pattern across all five is the same: an administrator may do something a user ' +
    'cannot, and in every case the action that could be contentious is written to the audit ' +
    'log with the acting administrator. The escrow override in 6.6 depends on this; it is ' +
    'acceptable for that override to exist only because it leaves a record.')

  h2('6.11', 'Resources and Interview Preparation');
  body('The resources module is a browsable library of uploaded material with a subject, a ' +
    'level and a type, together with a separate bank of interview questions. It is the ' +
    'module that failed most completely in the delivered system, and the reason is worth ' +
    'setting out because it is not an exotic fault.')

  h3('The library was unfilterable')
  body('Four of the seeded resources had never been approved, and nothing in the system ' +
    'approved them. Because the list query requires approval, those four were invisible. ' +
    'That was survivable. The fault that made the module unusable was in the count query.')

  code([
    '// The count query needs the same table alias as the main one. Every filter',
    '// below is written as r.<column> so the same clause can be appended to both',
    '// statements, and appending r.<column> to a query whose table was unaliased',
    '// made Postgres raise',
    '//   missing FROM-clause entry for table "r"',
    '// so every use of the subject, difficulty or type filter returned a 500',
    '// while the unfiltered list worked fine.',
    'let countQuery = \'SELECT COUNT(*) FROM resources r WHERE r.is_approved = true\';',
    'const params = [];',
    'const conditions = [];',
    '',
    'if (subject) {',
    '  conditions.push(`r.subject = $${params.length + 1}`);',
    '  params.push(subject);',
    '}'
  ], { caption: 'Listing 6.6  The aliased count query' });

  note('Why this fault was so effective at hiding itself',
    'The unfiltered list worked. The failure appeared only when a filter was applied, ' +
      'which is what a user does after the first screen has loaded and found nothing ' +
      'interesting. Because the response was a server error and the interface rendered an ' +
      'empty list rather than an error, the visible symptom was indistinguishable from ' +
      '"no resources match". The defect was found by running the filter combinations ' +
      'directly against the deployed system, not by reading the code, and it is a good ' +
      'argument for testing the second interaction rather than only the first.');

  h3('The fix in full')
  bullets([
    { text: 'The count query carries the same table alias as the list query, so both ' +
      'accept the same condition clauses.' },
    { text: 'The seeded resources are approved, and a seeding script was added so that ' +
      'a fresh database is not born with an empty library.' },
    { text: 'The vocabulary used by the filter options is normalised against the ' +
      'vocabulary actually present in the data, because a dropdown offering values that ' +
      'exist in no row returns nothing by construction.' },
    { text: 'The list response now carries the distinct subjects and levels alongside the ' +
      'rows, so the interface builds its options from what is actually there instead of ' +
      'from a hard-coded list.' }
  ]);

  h2('6.12', 'Background Scheduling');
  body('One scheduled task exists, and it is the most important one: releasing escrow that ' +
    'has passed its automatic release date. The escrow table carried a column for this ' +
    'date from the beginning, and nothing read it. A company that accepted a student and ' +
    'then went quiet left the money locked indefinitely, so the column promised a ' +
    'guarantee the system did not keep.')

  code([
    '/**',
    ' * Releases escrow that has passed its auto_release_at date.',
    ' *',
    ' * fundEscrow sets auto_release_at to seven days out, but nothing ever read that',
    ' * column, so a company that accepted a student and then went quiet would leave',
    ' * the student\'s money locked in escrow indefinitely. The column promised a',
    ' * guarantee the system did not keep.',
    ' *',
    ' *   node scripts/auto-release-escrows.js          report only, changes nothing',
    ' *   node scripts/auto-release-escrows.js --apply  actually release',
    ' *',
    ' * Refunds are deliberately not done here. Auto-releasing pays a student, which',
    ' * is the side that needs protecting, so a job that pays out unattended should',
    ' * be explicit about it. Default is report-only for that reason.',
    ' */',
    'require(\'dotenv\').config();',
    'const db = require(\'../src/config/database\');',
    '',
    'const APPLY = process.argv.includes(\'--apply\');',
    'const STALE_DAYS = 7;',
    '',
    '// Only gig students, never a company or an admin.',
    'const RELEASEABLE = [\'student\', \'alumni\'];'
  ], { caption: 'Listing 6.7  The automatic release job, header' });

  h3('Three decisions in this job')
  table(['Decision', 'Reason'], [
    ['Report only unless --apply is passed',
      'A scheduled job that pays people should not do so on a typo in a schedule. The ' +
      'first run shows what it would do.'],
    ['One transaction per escrow, not one for the batch',
      'A single malformed row cannot roll back every other release. The row is skipped ' +
      'and the run continues.'],
    ['Refunds are never automatic',
      'Auto-releasing pays the party that needs protecting. A job that moved money the ' +
      'other way unattended would remove money from someone who had already funded it.']
  ], [32, 68], { caption: 'Table 6.7  Design of the scheduled release' });

  body('The row lock is taken with a re-read inside the transaction, so if an ' +
    'administrator releases the same escrow by hand while the job is running, exactly one ' +
    'of the two pays and the other sees a terminal state and skips. This is the same ' +
    'at-most-once property as the manual path, which is what allows the job to be run by ' +
    'hand at any time without coordination.')

  h3('Deployment of the schedule')
  body('The job is declared in the deployment blueprint as a cron service that runs every ' +
    'few hours, invoking the same script. It is therefore the same code path whether it is ' +
    'run by the scheduler or typed by hand, which is the property that makes it safe to ' +
    'run by hand.')

  note('A defect in the blueprint itself',
    'The cron entry was initially indented four spaces while the services list was ' +
      'indented two. The file was not valid YAML, and the deployment failed to parse it ' +
      'before creating anything. It was found by parsing the file with a YAML reader ' +
      'rather than by reading it, because the indentation looks correct in a text editor ' +
      'and it is not. The blueprint is now parsed as part of the verification, which is ' +
      'the only reliable way to check a configuration file.');
};