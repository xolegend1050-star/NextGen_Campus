/**
 * Chapters 3 and 4.
 *
 * Chapter 3 states what the system must do, derived from the gap analysis of
 * Chapter 2 and from what the college can actually operate. Chapter 4 states how it
 * was built. The requirements in 3.2 are deliberately numbered FR-nn and NFR-nn so
 * that the defect log in Appendix K and the test summary in 7.2 can cite them
 * rather than paraphrasing them.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  // =====================================================================
  h1('3', 'System Analysis');
  mark('h1:3');

  h2('3.1', 'Requirement Gathering');
  body('Requirements were gathered from four sources, in this order, because the earlier ' +
    'sources turned out to be unreliable when taken alone.');

  h3('The gap identified in Chapter 2');
  body('The survey produced the four gaps in Table 2.5. Each was restated as a ' +
    'capability the system must have, and three of them survive into the final ' +
    'requirement set unchanged. The fourth, messaging history linked to outcome, was ' +
    'folded into the messaging requirement rather than kept separate, because a message ' +
    'thread that references a gig or a session already satisfies it and a separate ' +
    'feature would only duplicate it.')

  h3('The roles the college can actually support');
  body('A requirement list written only from student requests would be a wish list. Each ' +
    'role was asked what they would refuse to do without it. The company role produced ' +
    'the strongest single requirement in the project: it must not be possible for a ' +
    'company to withdraw money it has put into escrow without either receiving a ' +
    'deliverable or an administrator deciding the matter. The student role produced the ' +
    'mirror requirement: a student must be able to see that money has been committed ' +
    'before beginning work.')

  h3('What the deployment environment permits');
  body('The third source was the hosting environment, because it eliminated options that ' +
    'would otherwise have seemed reasonable. A single always-available runtime rules out a ' +
    'separate message broker. A free database tier rules out a queue table for scheduled ' +
    'work. A database in another region rules out anything that depends on many small ' +
    'round trips. These are recorded as constraints in 3.4 rather than treated as ' +
    'incidental.')

  h3('What testing the delivered system revealed');
  body('The fourth source is unusual but was the most productive. Exercising the finished ' +
    'system against each of its own roles produced requirements that had not been ' +
    'written down, most obviously that an untouched filter control must be treated as ' +
    'absent rather than as an invalid value. That is now FR-46 in Table 3.2, and it ' +
    'exists because the interface sent an empty string where the interface contract said ' +
    'it would send nothing. Requirements discovered this way are marked as such in the ' +
    'table, because a requirement that came from a defect is one that the original ' +
    'analysis missed.')

  h2('3.2', 'Functional Requirements');
    h3('Student');
  table(['#', 'Requirement', 'Origin'], [
    ['FR-08', 'A student may browse gigs and apply to one, with a short covering note', 'Gap 1'],
    ['FR-09', 'A student may see, for each gig, whether the company has funded escrow', 'Role interview'],
    ['FR-10', 'A student may submit a deliverable against a funded escrow, with a description and an attachment', 'Role interview'],
    ['FR-11', 'A student may receive payment into a wallet and may request a withdrawal', 'Gap 2'],
    ['FR-12', 'A student may request a mentorship session with a mentor, naming a topic', 'Gap 1'],
    ['FR-13', 'A student may rate a completed session, and the rating must persist against that session', 'Gap 4'],
    ['FR-14', 'A student may post a doubt and mark one answer as accepted', 'Survey 2.2'],
    ['FR-15', 'A student may upload a resource for moderation', 'Roles'],
    ['FR-16', 'A student may follow another user and be followed in return', 'Gap 4'],
    ['FR-17', 'A student may see a trust tier computed from their own activity', 'Gap 3']
  ], [8, 70, 22], { caption: 'Table 3.1b  Student functional requirements' });

  h3('Company');
  table(['#', 'Requirement', 'Origin'], [
    ['FR-18', 'A company may post a gig with a title, description, budget and required skills', 'Gap 1'],
    ['FR-19', 'A company may review applicants and accept or reject each one', 'Gap 1'],
    ['FR-20', 'A company may fund escrow against one accepted applicant', 'Gap 2'],
    ['FR-21', 'A company may release escrow to that applicant, but only against a submitted deliverable', 'Gap 2'],
    ['FR-22', 'A company may refund its own escrow before release', 'Gap 2'],
    ['FR-23', 'A company may not release escrow without a deliverable under any flag it supplies', 'Testing'],
    ['FR-24', 'A company may see a wallet balance, a locked balance and a transaction history', 'Gap 2'],
    ['FR-25', 'A company may respond to a student who has applied to it', 'Gap 1']
  ], [8, 70, 22], { caption: 'Table 3.1c  Company functional requirements' });

  h3('Mentor');
  table(['#', 'Requirement', 'Origin'], [
    ['FR-26', 'A mentor may declare availability as a weekly schedule', 'Gap 1'],
    ['FR-27', 'A mentor may accept, decline or propose a new time for a session request', 'Gap 1'],
    ['FR-28', 'Either party may mark a session complete; it is complete when both have', 'Gap 1'],
    ['FR-29', 'A student may rate a completed session on a defined scale', 'Gap 4'],
    ['FR-30', 'A mentor may publish a resource and may be shown their own session history', 'Gap 4']
  ], [8, 70, 22], { caption: 'Table 3.1d  Mentor functional requirements' });

  h3('Administrator');
  table(['#', 'Requirement', 'Origin'], [
    ['FR-31', 'An administrator may approve or reject a verification request', 'Roles'],
    ['FR-32', 'An administrator may approve or reject a submitted resource', 'Roles'],
    ['FR-33', 'An administrator may moderate a doubt or an answer and may remove either', 'Roles'],
    ['FR-34', 'An administrator may review the audit log', 'Roles'],
    ['FR-35', 'An administrator may approve or reject a withdrawal request, which releases or returns a hold', 'Testing'],
    ['FR-36', 'An administrator may release or refund escrow without a deliverable, and the action is logged', 'FR-23'],
    ['FR-37', 'An administrator may view analytics for the institution', 'Roles']
  ], [8, 70, 22], { caption: 'Table 3.1e  Administrator functional requirements' });

  h3('Cross-cutting requirements found during testing');
  table(['#', 'Requirement', 'Origin'], [
    ['FR-46', 'An empty filter control must be treated as absent, not as an invalid value', 'Defect D-12'],
    ['FR-47', 'Every list endpoint must validate its pagination parameters before use', 'Defect D-06'],
    ['FR-48', 'A request naming an identifier that is not a well-formed identifier must be rejected before any query', 'Defect D-05'],
    ['FR-49', 'A failure to send an email must be reported, not silently discarded', 'Defect D-09'],
    ['FR-50', 'A scheduled escrow release must be safe to run repeatedly and safe to run by hand', 'Defect D-07'],
    ['FR-51', 'A company paying one of several accepted applicants must be able to name which', 'Defect D-07']
  ], [8, 70, 22], { caption: 'Table 3.2  Requirements arising from verification of the delivered system' });

  h2('3.3', 'Non-Functional Requirements');
  body('Non-functional requirements are stated with the measurement that would show they ' +
    'are or are not met. A requirement that cannot be measured is an aspiration, and the ' +
    'three in this section are the ones most often written as aspirations.')

  table(['#', 'Requirement', 'Measure'], [
    ['NFR-01', 'No money moves without a committed transaction',
      'Every balance change is inside withTransaction; no controller issues an UPDATE on a wallet outside one.'],
    ['NFR-02', 'No unauthenticated request reaches business logic',
      'All 149 endpoints declare authenticate; the sweep asserts 401 for each.'],
    ['NFR-03', 'A malformed identifier produces 400, never 500',
      'Sweep sends malformed identifiers to every endpoint that takes one.'],
    ['NFR-04', 'A duplicate request does not duplicate its effect',
      'Escrow release is idempotent; a partial unique index enforces one live escrow per application.'],
    ['NFR-05', 'Every state-changing action is recorded',
      'Wallet transactions and the audit log carry the actor, the amount and the reference.'],
    ['NFR-06', 'A slow or cold service degrades rather than fails',
      'The client retries with backoff; the real-time client reconnects and re-fetches.'],
    ['NFR-07', 'The interface remains readable in black and white printing',
      'Pure black on white, no text below 9pt, borders rather than shading; verified by an automated check.'],
    ['NFR-08', 'No personal data is published without the owner\'s consent',
      'Profiles are private by default; a visibility setting governs public fields.']
  ], [9, 40, 51], { caption: 'Table 3.3  Non-functional requirements' });

  h2('3.4', 'System Constraints');
  body('Constraints are limitations imposed from outside the design. They are listed ' +
    'separately from requirements because they were not chosen, and a reader should be ' +
    'able to tell the two apart.')

  table(['Constraint', 'Effect on the design'], [
    ['The college has no placement cell, no employer database and no alumni register',
      'Institutions are modelled as records in the system rather than as external data, because there is no external source to import from.'],
    ['The system must be maintainable by one student',
      'No component that cannot be operated from a single repository was accepted. This excluded a separate queue service, a cache cluster and a separate admin console.'],
    ['Deployment is on a free tier that sleeps the service',
      'Cold start affects one service rather than several; the real-time client must tolerate being disconnected and must recover without a reload.'],
    ['The database is hosted in another region from the application',
      'Every list query is paginated and indexed on its filter columns; the connection pool is transaction-scoped with keepalive.'],
    ['The college cannot discharge payment-provider or tax obligations',
      'Mentorship is unpaid. Escrow is modelled as a ledger, and the platform holds funds in escrow only, never as revenue.'],
    ['No third-party video or scheduling service may be assumed available to students',
      'Sessions are scheduled in the system and held elsewhere; the system records completion, not attendance.']
  ], [40, 60], { caption: 'Table 3.4  System constraints and their design consequences' });

  h2('3.5', 'Architecture Overview');
  body('The system is a three-tier application with a persistent connection alongside the ' +
    'request path. Both sit in one Node.js process, which is the single most consequential ' +
    'architectural decision in the project and is defended in 3.5.2.')

  h3('The layers');
  numbered([
    'The presentation layer is a React single page application built with Vite. It holds ' +
      'no server-side rendering, because every route is behind authentication and there is ' +
      'therefore nothing for a crawler to index. State is held in Zustand, forms are ' +
      'validated with the same rules the server enforces, and the real-time client is a ' +
      'single module rather than one per screen.',
    'The application layer is an Express router tree. Eighteen route modules are mounted ' +
      'under a common prefix, and each route declares its own authentication and ' +
      'authorisation on the line that declares the route. Controllers contain business ' +
      'logic and no query construction; queries live in the controller module as ' +
      'parameterised statements.',
    'The data layer is PostgreSQL reached through a single small module that owns the ' +
      'pool and exposes a transaction helper. No other module creates a connection.'
  ]);

  h3('Why one process');
  body('The obvious objection to putting a WebSocket server and an HTTP API in one process ' +
    'is that they interfere with each other: a long-lived connection occupies resources ' +
    'that a request needs. In this system the number of concurrent socket connections is ' +
    'small, the request volume is low, and the alternative is a second service that must ' +
    'be paid for, deployed, monitored and kept alive. Given the environment, one process ' +
    'is the correct trade, and the consequences of it are stated rather than hidden: the ' +
    'service cannot be horizontally scaled without sticky sessions, and a slow request ' +
    'delays a socket heartbeat. Neither is a problem at this scale, and both would be at ' +
    'any larger one.')

  table(['Tier', 'Runs on', 'Interfaces with'], [
    ['Presentation', 'Static files, served by the web service',
      'HTTPS to the API; WebSocket for live updates'],
    ['Application', 'Node.js process',
      'HTTPS from the client; TCP to PostgreSQL; SMTP to the mail provider; HTTPS to OAuth providers'],
    ['Data', 'PostgreSQL',
      'TCP from the application only']
  ], [18, 34, 48], { caption: 'Table 3.5  Tier boundaries and interfaces' });

  // =====================================================================
  h1('4', 'System Design');
  mark('h1:4');

  h2('4.1', 'Architectural Design');
  body('The application layer is organised so that the authorisation policy of the whole ' +
    'system can be read in one pass. Each route module declares, on the same statement as ' +
    'the route, which authentication and which roles are required. There is no ' +
    'permission table, and no route whose protection is decided inside its controller.')

  body('The eighteen route modules, the number of endpoints in each and what each is ' +
    'responsible for are tabulated in full in Appendix B, Table B.1. That table is ' +
    'generated from the route files rather than typed, so a module added later appears ' +
    'there whether or not anyone remembered to update this chapter.');note('Why the module count is reported per module',
    'The table is generated by reading the route files rather than being maintained by ' +
      'hand. That is deliberate. An earlier version of this appendix was written ' +
      'manually and disagreed with the code within one commit, because adding a route ' +
      'does not remind anyone to edit a table in a report.');

  h2('4.2', 'Parameter Validation Design');
  body('Validation is applied at the route boundary, before any controller runs. Three ' +
    'classes of parameter caused real failures, and each has its own helper.')

  h3('Identifiers');
  body('Malformed identifiers previously reached PostgreSQL and produced an invalid input ' +
    'syntax error with a 500, which both leaked a database detail to the caller and let a ' +
    'caller probe column types. Every route taking an identifier validates it as a UUID ' +
    'first.')

  h3('Numeric query parameters')
  body('Checking that a pagination value is an integer was not sufficient, because page ' +
    'equals zero and page equals minus five are both integers and both produce a negative ' +
    'offset, which the database rejects. The helper therefore enforces both type and ' +
    'range, and treats a blank value as absent rather than as invalid.')

  code([
    'const DEFAULT_INT_BOUNDS = { page: [1, 1000000], limit: [1, 100] };',
    '',
    'const intQueries = (...args) => {',
    '  const bounds = args[args.length - 1];',
    '  const names =',
    '    typeof bounds === \'object\' && bounds !== null && !Array.isArray(bounds)',
    '      ? Object.keys(bounds)',
    '      : args.filter((a) => typeof a === \'string\');',
    '  const custom = typeof bounds === \'object\' && bounds !== null && !Array.isArray(bounds)',
    '    ? bounds : {};',
    '',
    '  return (req, res, next) => {',
    '    for (const name of names) {',
    '      if (req.query[name] === undefined) continue;',
    '      const raw = String(req.query[name]);',
    '      // A blank query param means "not supplied", same as undefined. Frontends',
    '      // build query strings by joining whatever is in a filter state object, so',
    '      // an untouched filter arrives as ?page=&limit= rather than being omitted.',
    '      if (!raw.trim()) continue;',
    '      if (!/^-?\\d+$/.test(raw)) {',
    '        return badRequest(res, `Invalid ${name}: must be an integer`);',
    '      }',
    '      const [min, max] = custom[name] || DEFAULT_INT_BOUNDS[name] || [1, 1000000];',
    '      const n = parseInt(raw, 10);',
    '      if (n < min || n > max) {',
    '        return badRequest(res, `Invalid ${name}: must be between ${min} and ${max}`);',
    '      }',
    '    }',
    '    return next();',
    '  };',
    '};'
  ], { caption: 'Listing 4.1  Range-checked numeric query validation' });

  note('What this listing prevents',
    'Three separate failures. A non-numeric value produces a 400 rather than a 500 from ' +
      'the driver. An out-of-range value produces a 400 rather than a negative offset ' +
      'error. And an empty value, which is what an untouched filter control actually ' +
      'sends, produces no error at all. The third case is the one that was found by ' +
      'using the interface rather than by reading the code, and it affected every list ' +
      'screen in the application at once.');

  h3('Optional form fields');
  body('The third class is the one that caused the widest outage of the delivered system. ' +
    'The validation library treats a field as optional only when it is undefined or null, ' +
    'so an empty string passes through to the checks that follow it and is rejected. An ' +
    'untouched input is an empty string, and a selection control whose first option is a ' +
    'placeholder is always an empty string, so optional fields failed on every form ' +
    'containing one. The fix is a sanitiser that rewrites a blank string to undefined ' +
    'before the optional check runs, and it is applied through a helper rather than by ' +
    'remembering it at each of the ninety-one call sites.')

  code([
    '/**',
    ' * Treat a blank string as an absent value.',
    ' *',
    ' * express-validator\'s optional() only skips undefined and null, so it does not',
    ' * skip "". Every optional form field in this app arrives as "" whenever the',
    ' * user leaves it alone: an untouched input is "", and a <select> whose first',
    ' * option is <option value="">Select subject</option> always posts "". The',
    ' * notEmpty()/isLength()/isURL() check that follows then rejects it and the',
    ' * whole form fails with a 400, even though the field was optional.',
    ' *',
    ' * A blank string is rewritten to undefined before optional() runs, so the rest',
    ' * of the chain is skipped. Only strings are touched: 0 and false stay intact,',
    ' * which matters because years_of_experience is legitimately 0.',
    ' *',
    ' * Usage: optionalField(body(\'subject\')).trim().notEmpty()',
    ' */',
    'const optionalField = (chain) =>',
    '  chain',
    '    .customSanitizer((value) => (',
    '      typeof value === \'string\' && value.trim() === \'\' ? undefined : value))',
    '    .optional();'
  ], { caption: 'Listing 4.2  The optional field helper' });

  h2('4.3', 'Database Design');
  body('The schema holds 54 tables and 567 columns. Four decisions shaped it, and each is ' +
    'a consequence of a requirement rather than of a preference.')

  h3('Money is stored as a fixed-point decimal');
  body('Every monetary column is a decimal with an explicit scale, never a floating point ' +
    'type. Binary floating point cannot represent a value such as 0.1 exactly, so ' +
    'repeated arithmetic accumulates an error that eventually becomes visible to a user ' +
    'as a wallet that does not add up. This matters more in this system than in most, ' +
    'because the platform holds escrow for a defined period and compares balances against ' +
    'the escrow records that justify them.')

  code([
    'CREATE TABLE wallets (',
    '  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),',
    '  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,',
    '  balance DECIMAL(12,2) DEFAULT 0.00,',
    '  locked_balance DECIMAL(12,2) DEFAULT 0.00,',
    '  total_earned DECIMAL(12,2) DEFAULT 0.00,',
    '  total_withdrawn DECIMAL(12,2) DEFAULT 0.00,',
    '  is_frozen BOOLEAN DEFAULT FALSE,',
    '  freeze_reason TEXT,',
    '  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),',
    '  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
    ');'
  ], { caption: 'Listing 4.3  The wallet table' });

  note('Why there are two balance columns',
    'A single balance column cannot represent money that is committed but not yet ' +
      'payable, and an earlier version of this system had exactly one column. A company ' +
      'that funded escrow saw the amount leave its balance and never saw it again ' +
      'anywhere, because the money was still in the platform but had no representation in ' +
      'the company own wallet. The invariant the schema now guarantees is that balance ' +
      'plus locked_balance equals the funds the platform holds for that user, and it is ' +
      'checked in the code that moves money rather than being hoped for.');

  h3('Every balance change is a committed transaction')
  body('All access to the database goes through one module. It exposes a pool, a simple ' +
    'query helper, and a transaction helper that is the only way a balance may be ' +
    'changed. The transaction helper is shown in full because its structure is the ' +
    'guarantee.')

  code([
    'const withTransaction = async (fn) => {',
    '  const client = await pool.connect();',
    '  try {',
    '    await client.query(\'BEGIN\');',
    '    const result = await fn(client);',
    '    await client.query(\'COMMIT\');',
    '    return result;',
    '  } catch (err) {',
    '    try {',
    '      await client.query(\'ROLLBACK\');',
    '    } catch (rollbackErr) {',
    '      console.error(\'? Rollback failed:\', rollbackErr.message);',
    '    }',
    '    throw err;',
    '  } finally {',
    '    client.release();',
    '  }',
    '};'
  ], { caption: 'Listing 4.4  The transaction helper' });

  body('Two properties of this helper are relied upon throughout the payment module. The ' +
    'callback receives the client rather than the pool, so every statement inside it runs ' +
    'on the same connection and therefore in the same transaction. And the connection is ' +
    'returned in a finally block, so a failed transaction does not leak a connection ' +
    'from the pool, which is the failure mode that makes a system degrade slowly rather ' +
    'than fail obviously.')

  h3('Constraints carry rules the application must not be trusted with');
  body('Application code can be wrong, and a database constraint cannot. The escrow ' +
    'amount is bounded at the database level, and there is at most one live escrow per ' +
    'application, enforced by a partial unique index so that the constraint applies only ' +
    'to rows that are actually live.')

  code([
    '-- Reject non-positive and absurd amounts at the database level',
    'DO $$',
    'BEGIN',
    '  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = \'escrow_amount_positive\') THEN',
    '    ALTER TABLE escrow_transactions',
    '      ADD CONSTRAINT escrow_amount_positive CHECK (amount > 0 AND amount <= 10000000);',
    '  END IF;',
    'END $$;',
    '',
    '-- At most one live escrow per application',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_one_locked_per_application',
    '    ON escrow_transactions (application_id)',
    '    WHERE application_id IS NOT NULL AND status = \'locked\';'
  ], { caption: 'Listing 4.5  Database-level escrow constraints' });

  note('Why the amount constraint is a defence and not a formality',
    'Without it, a negative amount is not rejected by the arithmetic; it is accepted, and ' +
      'it credits the company instead of debiting it. A caller who supplied a negative ' +
      'value would be paid to part with money, and the balance would rise. Application ' +
      'validation catches the obvious cases, but a constraint makes the rule independent ' +
      'of every code path that might reach this table.');

  h3('Timestamps and triggers');
  body('Every table carries creation and update timestamps. The update timestamp is ' +
    'maintained by a trigger rather than by the application, so a row updated by a script, ' +
    'a migration or a future service still records when it changed. There are 23 such ' +
    'triggers, and the notification table uses one in addition to the usual pair, to ' +
    'ensure that reading a notification updates a field that no application statement ' +
    'was setting.')

  h2('4.4', 'State Machines');
  body('Three parts of the system have state that must not be advanced incorrectly: escrow, ' +
    'verification, and mentorship sessions. All three follow the same rule, which is that ' +
    'every transition is expressed as a check against the current state inside the same ' +
    'transaction that performs the change.')

  h3('Escrow');
  table(['Current state', 'Requested action', 'Result'], [
    ['locked', 'Release, deliverable present', 'Balance moves to the student; state becomes released'],
    ['locked', 'Release, no deliverable, non-administrator', 'Rejected with 403'],
    ['locked', 'Release, no deliverable, administrator', 'Released, and the override is logged'],
    ['locked', 'Refund', 'Money returns to the company; state becomes refunded'],
    ['released', 'Release again', 'No-op, reported as already released; no second payment'],
    ['released', 'Refund', 'Rejected with 400'],
    ['refunded', 'Release', 'Rejected with 400'],
    ['disputed', 'Release or refund', 'Rejected until an administrator resolves it']
  ], [18, 34, 48], { caption: 'Table 4.2  Escrow transition table as implemented' });

  h3('Verification');
  body('Verification moves through unverified, pending, verified and rejected. A rejected ' +
    'user may submit again, which returns the state to pending; a verified user does not ' +
    'regress. The rule that a rejection must carry a reason is enforced in the state ' +
    'machine rather than in the controller, so it holds however the rejection is reached.')

  h3('Mentorship sessions');
  body('A session is requested, then accepted or declined, then scheduled, then completed, ' +
    'and only a completed session may be rated. Completion requires both parties to mark ' +
    'it, which prevents one side declaring a session finished unilaterally. Rating is ' +
    'therefore impossible until the session is genuinely complete, and it is possible ' +
    'exactly once.')

  h2('4.5', 'Security Design');
  body('Security in this system is built from a small number of rules applied consistently, ' +
    'rather than from a long list of special cases.')

  bullets([
    { text: 'Authentication is required at the route, not inside the controller. A route ' +
      'with no authentication declaration is a defect, and the sweep fails the build if ' +
      'one appears.' },
    { text: 'Authorisation names the permitted roles at the route. The full policy is ' +
      'therefore readable in one pass over eighteen files.' },
    { text: 'Every query is parameterised. No user-supplied value is concatenated into ' +
      'a statement anywhere in the application tier.' },
    { text: 'Access to a record is checked against its owner, not merely against the ' +
      'caller role. Being a company does not make every escrow visible.' },
    { text: 'Passwords are hashed with bcrypt. Access tokens are verified without a ' +
      'database read; refresh tokens are stored as hashes so they can be revoked.' },
    { text: 'Uploaded files are validated by their actual content type rather than by ' +
      'the name or the declared type supplied by the client.' },
    { text: 'Every administrative override is recorded in the audit log with the acting ' +
      'administrator, which is what makes the escrow override in Table 4.2 defensible.' }
  ]);

  h3('Token uniqueness')
  body('One property of the token design is not obvious and was found by reading the code ' +
    'rather than by the survey. A JSON Web Token is only unique if something inside it ' +
    'varies. With a payload of only a user identifier and an issued-at time of one-second ' +
    'resolution, two tokens minted for the same user in the same second are byte ' +
    'identical. Because refresh tokens are stored as a hash, they collapse onto a single ' +
    'stored row, and rotating one silently leaves the other valid. Giving every token a ' +
    'random identifier makes them distinct.')

  code([
    'const generateTokens = (userId) => {',
    '  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + \'-refresh\';',
    '  // A JWT is only unique if something in its payload is. Two tokens signed for',
    '  // the same user within the same second used to be byte-identical, because',
    '  // iat has one-second resolution and the payload was just { userId }.',
    '  //',
    '  // That let two sessions share a token_hash: registering and then logging in',
    '  // inside the same second produced two rows with the same hash, so rotating or',
    '  // logging out of one left the other working, and a spent refresh token could',
    '  // be reused through the duplicate row. jti makes every token distinct.',
    '  const token = jwt.sign({ userId, jti: crypto.randomUUID() }, process.env.JWT_SECRET, {',
    '    expiresIn: process.env.JWT_EXPIRES_IN || \'1h\'',
    '  });',
    '  const refreshToken = jwt.sign({ userId, jti: crypto.randomUUID() }, refreshSecret, {',
    '    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || \'7d\'',
    '  });',
    '  return { token, refreshToken };',
    '};'
  ], { caption: 'Listing 4.6  Token generation with a unique identifier' });

  h2('4.6', 'Interface Design');
  body('The interface follows the role, so a student never sees a control they cannot use ' +
    'and never is shown a page that exists only to help an administrator. Three decisions ' +
    'in it are worth stating because they were changed during the project.')

  h3('Cards are not links')
  body('An application card was originally a link wrapping the whole card. That is ' +
    'attractive to write and awkward to use, because every control inside the card is ' +
    'then inside an anchor, so the submit button inherits link behaviour and the ' +
    'accessible structure is a nest of interactive elements. The card is now a plain ' +
    'container and the title is the link, with the action button as a sibling.');

  h3('Wallet labels depend on the viewer')
  body('A single label for the locked balance was wrong for half the users. For a company, ' +
    'the locked figure is money committed to escrow and still owned. For a student it is ' +
    'money already earned and awaiting withdrawal. The same number, two meanings, so the ' +
    'label is chosen from the role: "Locked in Escrow" for a company, "Pending ' +
    'Withdrawals" for a student.')

  h3('Nothing depends on a page load to reveal state')
  body('Lists filter and paginate without a full navigation, and a result count is always ' +
    'shown, because an empty result caused by a filter that silently did nothing is ' +
    'indistinguishable from an empty collection. The resources screen originally had that ' +
    'failure: every filter combination returned a server error, and the interface showed ' +
    'an empty list rather than the error.')
};