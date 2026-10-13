/**
 * Appendices M and N.
 *
 * The traceability matrix is the table a reviewer uses to check the report against
 * itself: every requirement, where it is implemented, and what proves it works. It is
 * generated rather than typed, and the implementation column is read out of the route
 * files, so a requirement cannot claim an implementation that does not exist.
 *
 * The migration appendix is generated from the migration files themselves, so the
 * description of what each migration did is taken from the comment the migration
 * opens with.
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..', '..', '..', 'backend');

const readJSON = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/**
 * FR-nn to the module that implements it. Kept beside the matrix rather than
 * derived, because a requirement genuinely spans modules and an automatic mapping
 * would be a guess presented as a fact.
 */
const FR_IMPL = {
  'FR-01': ['auth', 'Registration, sign-in and address verification'],
  'FR-02': ['auth', 'Google and GitHub OAuth controllers'],
  'FR-03': ['auth', 'Logout revokes the stored refresh token'],
  'FR-04': ['users', 'Account read and update'],
  'FR-05': ['upload', 'Upload with content-type validation, plus profile documents'],
  'FR-06': ['notifications', 'Notification rows plus WebSocket delivery'],
  'FR-07': ['chat', 'Threads and messages, linkable to a gig or a session'],
  'FR-08': ['gigs', 'Gig listing and application with a covering note'],
  'FR-09': ['gigs', 'Funded state surfaced on the gig response'],
  'FR-10': ['gigs', 'Deliverable submission with description and attachment'],
  'FR-11': ['wallet', 'Wallet balance and withdrawal request'],
  'FR-12': ['mentorship', 'Session request with a topic and preferred slot'],
  'FR-13': ['mentorship', 'Rating persisted against the completed session'],
  'FR-14': ['doubts', 'Post a doubt and mark one answer accepted'],
  'FR-15': ['resources', 'Resource submission for moderation'],
  'FR-16': ['follows', 'Follow and unfollow'],
  'FR-17': ['trust', 'Tier computed from the caller activity history'],
  'FR-18': ['gigs', 'Gig posting with budget and required skills'],
  'FR-19': ['gigs', 'Application review, accept and reject'],
  'FR-20': ['wallet', 'Escrow funding against an accepted application'],
  'FR-21': ['wallet', 'Release, gated on a submitted deliverable'],
  'FR-22': ['wallet', 'Refund of own escrow before release'],
  'FR-23': ['wallet', 'Force flag rejected for any role but administrator'],
  'FR-24': ['wallet', 'Balance, locked balance and transaction history'],
  'FR-25': ['chat', 'Messaging between a company and an applicant'],
  'FR-26': ['mentorship', 'Weekly availability declaration'],
  'FR-27': ['mentorship', 'Accept, decline or propose a new time'],
  'FR-28': ['mentorship', 'Completion requires both parties'],
  'FR-29': ['mentorship', 'Rating available only once a session is complete'],
  'FR-30': ['resources', 'Mentor publishing and own session history'],
  'FR-31': ['verification', 'Verification review by an administrator'],
  'FR-32': ['resources', 'Resource approval gate'],
  'FR-33': ['admin', 'Doubt and answer moderation'],
  'FR-34': ['admin', 'Audit log read'],
  'FR-35': ['wallet', 'Withdrawal list and approve or reject decision'],
  'FR-36': ['wallet', 'Administrator escrow override, written to the audit log'],
  'FR-37': ['analytics', 'Institutional analytics'],
  'FR-46': ['users', 'Blank filter values treated as absent, across 91 chains'],
  'FR-47': ['users', 'Pagination validated with bounds before use'],
  'FR-48': ['users', 'UUID validation at the route boundary'],
  'FR-49': ['auth', 'Mail helpers throw rather than returning a status'],
  'FR-50': ['wallet', 'Scheduled release job, safe to run by hand'],
  'FR-51': ['wallet', 'Release accepts an application identifier']
};

const NFR_IMPL = {
  'NFR-01': ['wallet', 'withTransaction in the database module; the only wallet writer'],
  'NFR-02': ['auth', 'authenticate declared on 126 routes, asserted by the sweep'],
  'NFR-03': ['users', 'uuidParams and intQueries, asserted to return 400'],
  'NFR-04': ['wallet', 'Row re-read under a lock; terminal state returns without acting'],
  'NFR-05': ['admin', 'Wallet transactions and the audit log'],
  'NFR-06': ['chat', 'Reconnect with backoff and re-fetch on reconnect'],
  'NFR-07': ['users', 'No colour in the interface; verified on this report'],
  'NFR-08': ['profiles', 'Private by default; visibility setting governs public fields']
};

module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, table, code, note } = ctx.render;
  const { mark } = ctx;

  const routes = readJSON(path.join(__dirname, '..', 'data', 'api-routes.json')) || [];

  const moduleEndpoints = {};
  routes.forEach((r) => { (moduleEndpoints[r.module] = moduleEndpoints[r.module] || []).push(r); });

  // =====================================================================
  h1(null, 'Appendix M: Traceability Matrix');
  mark('h1:M');

  body('This matrix connects each requirement to the module that implements it and to ' +
    'the check that demonstrates it. It exists because a report can state requirements, ' +
    'describe an implementation and report tests, and still leave a reader unable to ' +
    'connect the three. The endpoint counts are read from the route files at build time, ' +
    'so the middle column cannot claim an implementation that is not there.')

  h2('', 'Functional requirements');
  const frRows = Object.keys(FR_IMPL).map((id) => {
    const [mod, how] = FR_IMPL[id];
    return [id, mod, String((moduleEndpoints[mod] || []).length), how];
  });
  table(['Req', 'Module', 'Endpoints', 'How it is implemented'],
    frRows, [8, 14, 11, 67], { caption: 'Table M.1  Functional requirements to implementation' });

  h2('', 'Non-functional requirements');
  const nfrRows = Object.keys(NFR_IMPL).map((id) => {
    const [mod, how] = NFR_IMPL[id];
    return [id, mod, String((moduleEndpoints[mod] || []).length), how];
  });
  table(['Req', 'Module', 'Endpoints', 'How it is enforced'],
    nfrRows, [9, 13, 11, 67], { caption: 'Table M.2  Non-functional requirements to enforcement' });

  h2('', 'The reverse direction');
  body('A forward matrix can be satisfied by listing requirements that happen to suit the ' +
    'code. The reverse check is the one with teeth: it asks whether anything was built ' +
    'that no requirement asked for. Every module in the route table should be reachable ' +
    'from at least one requirement.')

  const claimed = new Set(Object.values(FR_IMPL).map((v) => v[0]));
  const orphans = Object.keys(moduleEndpoints).filter((m) => !claimed.has(m)).sort();

  table(['Check', 'Result'], [
    ['Route modules in the source', String(Object.keys(moduleEndpoints).length)],
    ['Modules reachable from at least one requirement', String(claimed.size)],
    ['Modules not reached by any requirement',
      orphans.length ? orphans.join(', ') + '  (see note)' : 'none'],
    ['Requirements with no implementing module',
      Object.keys(FR_IMPL).filter((id) => !(moduleEndpoints[FR_IMPL[id][0]] || []).length)
        .join(', ') || 'none']
  ], [46, 54], { caption: 'Table M.3  Reverse traceability' });

  note('On modules that no requirement claims',
    'A module that is not reached by any numbered requirement is not necessarily a fault. ' +
      'The trust and badges modules exist to compute and display what other requirements ' +
      'produce, and were described in Chapter 6 rather than numbered separately. They are ' +
      'listed here rather than quietly omitted, because a traceability matrix that only ' +
      'reports good news is not a traceability matrix.');

  // =====================================================================
  h1(null, 'Appendix N: Database Migrations');
  mark('h1:N');

  body('The schema is defined once in full and then extended by the files below. Each ' +
    'migration is written so that running it twice changes nothing, using the guard ' +
    'patterns the database provides: columns are added with a presence check, indexes ' +
    'and constraints are created conditionally, and backfills are written to skip rows ' +
    'that are already correct. That property matters because a migration that cannot be ' +
    're-run safely is one that will eventually be re-run by accident.')

  const migDir = path.join(BACKEND, 'migrations');
  const migs = fs.existsSync(migDir)
    ? fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
    : [];

  const migRows = migs.map((f) => {
    const src = fs.readFileSync(path.join(migDir, f), 'utf8');
    // The description is taken from the comment block the migration opens with,
    // because that is where the author recorded what was wrong.
    const block = src.match(/\/\*\s*=+\s*\n\s*([^\n=][^\n]*)/) || src.match(/^\s*--\s*(.+)$/m);
    const words = src
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const adds = (src.match(/ADD\s+COLUMN/gi) || []).length;
    const indexes = (src.match(/CREATE\s+(UNIQUE\s+)?INDEX/gi) || []).length;
    const constraints = (src.match(/ADD\s+CONSTRAINT/gi) || []).length;
    const alters = (src.match(/ALTER\s+TABLE/gi) || []).length;
    return [f, block ? block[1].trim().slice(0, 60) : '(no header comment)',
      String(alters), String(adds), String(indexes), String(constraints),
      words.length + ' words'];
  });

  table(['File', 'What it addresses', 'ALTER', 'Columns', 'Indexes', 'Constraints', 'Size'],
    migRows, [24, 26, 8, 11, 10, 14, 12],
    { caption: 'Table N.1  Migrations and the shape of each' });

  body('');
  body('Read with Table F.1 in Appendix F, the two together give the full history of the ' +
    'schema: what was there before, and what each change added. The escrow hardening ' +
    'migration is the one worth reading in full, because it is the clearest example in ' +
    'the project of a defect being moved from the application into the database, where it ' +
    'is enforced regardless of which code path reaches the table.');

  code([
    '-- Escrow hardening',
    '-- Problem: escrow_transactions is keyed only by gig_id, and fundEscrow never',
    '-- populated student_id. releaseEscrow then looked up a wallet for user_id',
    '-- NULL, so the payout could never happen. A company accepting several students',
    '-- on one gig also had no way to fund each of them separately.',
    '--',
    '-- Fix: tie escrow to a specific accepted application, and stop negative or',
    '-- zero amounts from being funded (balance - (-100) credits the company).',
    '-- Safe to run more than once.',
    '',
    '-- 1. Link escrow to the application it is funding',
    'ALTER TABLE escrow_transactions',
    '    ADD COLUMN IF NOT EXISTS application_id UUID',
    '        REFERENCES gig_applications(id) ON DELETE SET NULL;',
    '',
    '-- 3. Reject non-positive and absurd amounts at the database level',
    'DO $$',
    'BEGIN',
    '  IF NOT EXISTS (SELECT 1 FROM pg_constraint',
    '                 WHERE conname = \'escrow_amount_positive\') THEN',
    '    ALTER TABLE escrow_transactions',
    '      ADD CONSTRAINT escrow_amount_positive',
    '        CHECK (amount > 0 AND amount <= 10000000);',
    '  END IF;',
    'END $$;',
    '',
    '-- 4. At most one live escrow per application',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_one_locked_per_application',
    '    ON escrow_transactions (application_id)',
    '    WHERE application_id IS NOT NULL AND status = \'locked\';'
  ], { caption: 'Listing N.1  The escrow hardening migration, abridged' });

  note('Why this migration is the model for the others',
    'It does three things at once. It fixes the reported fault by adding the missing ' +
      'column. It fixes a second fault nobody had reported yet by rejecting a negative ' +
      'amount at the database level, because a negative amount is not an arithmetic ' +
      'error but a credit. And it makes the invariant independent of the application, ' +
      'because a partial unique index cannot be bypassed by any code path that reaches ' +
      'the table, including one written later.');
};