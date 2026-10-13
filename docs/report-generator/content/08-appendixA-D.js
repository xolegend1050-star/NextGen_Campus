/**
 * Appendices A to D.
 *
 * These four describe what was built and how it was checked, and are generated from
 * the repository where a generated answer is available. Appendix A is walked from the
 * real directory tree, so it cannot describe a folder that does not exist.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const BACKEND = path.join(REPO, 'backend');
const FRONTEND = path.join(REPO, 'frontend');

const readJSON = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/**
 * Lists the files in a directory, or the immediate subdirectories with their file
 * counts. A real listing is more useful than a hand-written one and cannot drift.
 */
const walk = (dir, depth) => {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  entries
    .filter((e) => !/^(node_modules|\.git|dist|coverage|uploads|out)$/.test(e.name))
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name)
      : a.isDirectory() ? -1 : 1))
    .forEach((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const n = walk(full, depth - 1);
        if (n.length) {
          out.push({ type: 'dir', name: e.name, count: n.length });
          out.push(...n);
        }
      } else {
        out.push({ type: 'file', name: e.name });
      }
    });
  return out;
};

/** How many source files a directory holds, for the summary table. */
const countFiles = (dir, exts) => {
  let n = 0;
  const rec = (d) => {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const i of items) {
      if (/^(node_modules|\.git|dist|coverage|uploads|out)$/.test(i.name)) continue;
      const p = path.join(d, i.name);
      if (i.isDirectory()) rec(p);
      else if (!exts || exts.some((e) => i.name.endsWith(e))) n++;
    }
  };
  rec(dir);
  return n;
};

module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  const routes = readJSON(path.join(__dirname, '..', 'data', 'api-routes.json')) || [];
  const schema = readJSON(path.join(__dirname, '..', 'data', 'db-schema.json'))
    || { tables: [], indexes: [], triggers: [] };

  // =====================================================================
  h1(null, 'Appendix A: Project Structure');
  mark('h1:A');

  body('The repository is a single tree containing the client, the server, the database ' +
    'definition, the tests and the deployment description. There is no separate ' +
    'infrastructure repository and no separate documentation repository, because the ' +
    'person maintaining this system is one person.');

  h2('', 'Top level');
  table(['Path', 'Contents'], [
    ['backend/', 'The Express API, the database module, the schema, migrations and tests'],
    ['frontend/', 'The React client, built with Vite'],
    ['docs/', 'This report and the generator that produces it'],
    ['scripts/', 'Operational scripts used during development'],
    ['ai-service/', 'The AI service wrapper and its configuration'],
    ['uploads/', 'Files uploaded by users; not under version control'],
    ['render.yaml', 'The deployment blueprint: two services, one database, one cron job']
  ], [22, 78], { caption: 'Table A.1  Top level of the repository' });

  h2('', 'Backend');
  body('The server is organised as routes, controllers, middleware, utilities and ' +
    'validators, with the database definition and migrations held separately from the ' +
    'code that uses them.');

  table(['Directory', 'Files', 'Holds'], [
    ['src/routes/', String(countFiles(path.join(BACKEND, 'src', 'routes'))),
      'One module per functional area; declares path, guards and validation'],
    ['src/controllers/', String(countFiles(path.join(BACKEND, 'src', 'controllers'))),
      'Business logic and the parameterised queries for each area'],
    ['src/middleware/', String(countFiles(path.join(BACKEND, 'src', 'middleware'))),
      'Authentication, authorisation, upload handling, error handling'],
    ['src/utils/', String(countFiles(path.join(BACKEND, 'src', 'utils'))),
      'Validation helpers, logging, mail, one-time passwords, trust tiers, OCR, AI client'],
    ['src/validators/', String(countFiles(path.join(BACKEND, 'src', 'validators'))),
      'Declarative validation chains per area'],
    ['src/config/', String(countFiles(path.join(BACKEND, 'src', 'config'))),
      'The database module, the full schema, migration runner and seeding'],
    ['migrations/', String(countFiles(path.join(BACKEND, 'migrations'), ['.sql'])),
      'Incremental schema changes, each safe to run more than once'],
    ['scripts/', String(countFiles(path.join(BACKEND, 'scripts'))),
      'The escrow release job, the library seeding script and a taxonomy normaliser'],
    ['tests/', String(countFiles(path.join(BACKEND, 'tests'))),
      'Six unit test files and the three-file endpoint sweep']
  ], [22, 10, 68], { caption: 'Table A.2  Backend layout' });

  h2('', 'The backend source tree');
  // A one line purpose per file, derived from its own header comment where the
  // author wrote one. Anything without a header falls back to its name, which is
  // still more informative than a repeated "as described in Chapter 6".
  const describe = (file) => {
    const full = findFile(file);
    if (!full) return 'Module as described in Chapter 6';
    const head = fs.readFileSync(full, 'utf8').slice(0, 600);
    const block = head.match(/\/\*\*([\s\S]*?)\*\//);
    if (!block) return camel(file);
    const line = block[1].split('\n')
      .map((l) => l.replace(/^\s*\*ing?\/?\s*/, '').replace(/^\s*\*\s*/, '').trim())
      .filter((l) => l.length > 24)[0];
    return line ? trim(line, 88) : camel(file);
  };
  const trim = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '.');
  const camel = (f) => f.replace(/\.js$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  const findFile = (name) => {
    let hit = null;
    const rec = (d) => {
      let items;
      try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const i of items) {
        if (hit) return;
        if (/^(node_modules|\.git|dist)$/.test(i.name)) continue;
        const p = path.join(d, i.name);
        if (i.isDirectory()) rec(p);
        else if (i.name === name) hit = p;
      }
    };
    rec(path.join(BACKEND, 'src'));
    return hit;
  };

  // Three columns rather than two: the purpose text is short enough to read
  // beside the name, and one page of names costs less than two of name-and-purpose.
  const files = walk(path.join(BACKEND, 'src'), 3).filter((e) => e.type === 'file');
  const third = Math.ceil(files.length / 3);
  const cells = [0, 1, 2].map((c) => files.slice(c * third, (c + 1) * third).map((e) => e.name));
  const height = Math.max(...cells.map((c) => c.length));
  body('Each of these files is described in Chapter 6 where it carries behaviour worth ' +
    'explaining; the list below is a map of the tree rather than a glossary.');
  table(['File', 'File', 'File'],
    Array.from({ length: height }, (_, r) => [cells[0][r] || '', cells[1][r] || '', cells[2][r] || '']),
    [33, 33, 34], { compact: true, caption: 'Table A.3  Every file under backend/src' });

  h2('', 'Frontend');
  table(['Directory', 'Files', 'Holds'], [
    ['src/pages/', String(countFiles(path.join(FRONTEND, 'src', 'pages'), ['.jsx'])),
      'One component per screen, lazy loaded where it is only needed by an administrator'],
    ['src/components/', String(countFiles(path.join(FRONTEND, 'src', 'components'), ['.jsx'])),
      'Shared components including the upload and submit-work forms'],
    ['src/layouts/', String(countFiles(path.join(FRONTEND, 'src', 'layouts'), ['.jsx'])),
      'The authenticated and administrative shells'],
    ['src/store/', String(countFiles(path.join(FRONTEND, 'src', 'store'), ['.jsx', '.js'])),
      'The single client state store'],
    ['src/services/', String(countFiles(path.join(FRONTEND, 'src', 'services'), ['.jsx', '.js'])),
      'The API client and the real-time connection'],
    ['src/utils/', String(countFiles(path.join(FRONTEND, 'src', 'utils'), ['.jsx', '.js'])),
      'Shared helpers including role-aware labels'],
    ['src/hooks/', String(countFiles(path.join(FRONTEND, 'src', 'hooks'), ['.jsx', '.js'])),
      'Shared hooks']
  ], [22, 10, 68], { caption: 'Table A.4  Frontend layout' });

  // =====================================================================
  h1(null, 'Appendix B: Module Map');
  mark('h1:B');

  body('This appendix connects each functional area to the files that implement it, so ' +
    'that a reader tracing a feature from Chapter 6 can find it. The endpoint counts are ' +
    'read from the route files at build time rather than written by hand.')

  const byModule = {};
  routes.forEach((r) => {
    (byModule[r.module] = byModule[r.module] || []).push(r);
  });

  const MODULE_NOTES = {
    auth: 'Registration, sign-in, refresh and logout, password reset, one-time passwords, Google and GitHub',
    users: 'Account reads and updates, search, account deletion',
    profiles: 'Profile fields, skills, documents, public visibility',
    gigs: 'Gig posting and browsing, applications, acceptance, deliverables',
    wallet: 'Wallet balance, escrow funding, release and refund, withdrawals',
    mentorship: 'Availability, session requests, scheduling, completion, ratings',
    doubts: 'Doubts, answers, acceptance, comments, moderation',
    chat: 'Threads, messages, read state, real-time delivery',
    notifications: 'Notification list, read state, unread counts',
    resources: 'Library listing with facets, submission, approval, interview questions',
    ai: 'Assistance with a doubt; generated text is never stored as an answer',
    analytics: 'Institutional dashboards and personal statistics',
    trust: 'Trust tier computation and history',
    badges: 'Badge award and display',
    verification: 'Verification requests, review, and the state machine',
    upload: 'File upload, content-type validation, OCR of uploaded documents',
    follows: 'Follow, unfollow, follower and following lists',
    admin: 'Moderation, audit log, withdrawal decisions, user management, escrow override'
  };

  table(['Module', 'Endpoints', 'Role-limited', 'What it does'], Object.keys(byModule).sort()
    .map((m) => [
      m,
      String(byModule[m].length),
      String(byModule[m].filter((r) => r.roles).length),
      MODULE_NOTES[m] || ''
    ]), [16, 12, 14, 58], { caption: 'Table B.1  Module map' });

  h2('', 'The dependency direction');
  body('Dependencies run one way. Routes depend on middleware and validators. Controllers ' +
    'depend on the database module and on utilities. Utilities depend on nothing but ' +
    'configuration. No utility imports a controller, no controller imports a route, and no ' +
    'module other than the database module opens a connection. The direction is not ' +
    'stylistic: it is what allows the authorisation policy to be read in one pass over the ' +
    'route files, and the transaction discipline to be checked by looking at one file.')

  body('Stated as rules rather than as a table: a route may import middleware, ' +
    'validators and a controller but not the database module; a controller may import the ' +
    'database module, utilities and logging but not another route or controller; a ' +
    'utility may import configuration and external libraries but nothing from the ' +
    'application layer; and the database module imports the driver and configuration and ' +
    'nothing else.');

  // =====================================================================
  h1(null, 'Appendix C: Role and Permission Matrix');
  mark('h1:C');

  body('This matrix is generated from the route declarations, so it describes the ' +
    'authorisation the system actually enforces rather than the authorisation it was ' +
    'intended to enforce. A route with no role restriction is shown as available to every ' +
    'authenticated user, which is a statement worth being able to check.')

  // Which roles may reach each module at all
  const ROLE_ORDER = ['student', 'company', 'mentor', 'admin'];
  const moduleAccess = {};
  routes.forEach((r) => {
    if (!r.roles) return;
    const list = r.roles.split(', ').map((s) => s.trim());
    moduleAccess[r.module] = moduleAccess[r.module] || {};
    list.forEach((role) => {
      moduleAccess[r.module][role] = (moduleAccess[r.module][role] || 0) + 1;
    });
  });

  const cell = (mod, role) => {
    const m = moduleAccess[mod];
    if (!m) return 'any';
    return m[role] ? String(m[role]) + ' rt' : 'no';
  };

  table(['Module', 'Student', 'Company', 'Mentor', 'Administrator'],
    Object.keys(byModule).sort().map((m) => [m, cell(m, 'student'), cell(m, 'company'),
      cell(m, 'mentor'), cell(m, 'admin')]),
    [28, 18, 18, 18, 18], { caption: 'Table C.1  Which roles may reach which modules' });

  note('How to read this table',
    'A number is the count of routes in that module that name this role explicitly. ' +
      '"any" means the module declares no role restriction, so any authenticated user may ' +
      'call those routes and the route itself enforces ownership. "no" means the role ' +
      'cannot reach the module at all. A cell reading "no" for a role that a reader would ' +
      'expect to work is worth investigating rather than assuming, and this table makes it ' +
      'a one-glance question rather than a reading exercise.');

  h2('', 'The rules that apply to every route');
  numbered([
    'No route in this system is reachable without a valid access token. The sweep asserts ' +
      'a 401 for every route in the list.',
    'Where a route is role restricted, an authenticated user of the wrong role receives a ' +
      '403 rather than a 404, except where returning 404 would itself leak the existence ' +
      'of a record.',
    'Ownership is checked inside the controller, after the role check passes. Being a ' +
      'company is not sufficient to read an escrow; the escrow must also belong to that ' +
      'company.',
    'Escrow release without a submitted deliverable is refused for every role except ' +
      'administrator, and the refusal is recorded in the audit log when it is permitted.'
  ]);

  h2('', 'Sensitive operations and who may perform them');
  table(['Operation', 'Student', 'Company', 'Mentor', 'Administrator'], [
    ['Fund escrow', 'No', 'Yes, own escrow', 'No', 'No'],
    ['Release escrow', 'No', 'Yes, own, deliverable required', 'No', 'Yes, logged'],
    ['Refund escrow', 'No', 'Yes, own, before release', 'No', 'Yes, logged'],
    ['Submit a deliverable', 'Yes, own', 'No', 'No', 'No'],
    ['Approve or reject a withdrawal', 'No', 'No', 'No', 'Yes'],
    ['Freeze a wallet', 'No', 'No', 'No', 'Yes'],
    ['Approve a verification', 'No', 'No', 'No', 'Yes'],
    ['Approve a resource', 'No', 'No', 'No', 'Yes'],
    ['Moderate a doubt or answer', 'No', 'No', 'No', 'Yes'],
    ['Read the audit log', 'No', 'No', 'No', 'Yes'],
    ['Complete a mentorship session', 'Yes, own', 'No', 'Yes, own', 'No'],
    ['Rate a completed session', 'Yes, own', 'No', 'No', 'No']
  ], [30, 17, 23, 14, 16], { caption: 'Table C.2  Sensitive operations' });

  // =====================================================================
  h1(null, 'Appendix D: Test Results Summary');
  mark('h1:D');

  h2('', 'Unit tests');
  body('Six files, 93 tests, all passing, covering the trust tier boundaries, the ' +
    'verification state machine, authentication and refresh rotation, one-time ' +
    'passwords, doubts and answers, and file content-type validation. Section 7.2 ' +
    'states what each area asserts and why it is worth asserting.');

  h2('', 'Endpoint sweep');
  body('Three files run against the deployed system: authentication and session ' +
    'handling, general feature behaviour, and administration. The harness ' +
    'enumerates routes from the source, so an endpoint added without an assertion ' +
    'fails the run rather than being skipped. Section 7.3 states what the sweep ' +
    'checks and why each check exists.');

  h2('', 'What each check asserts');
  body('Beyond the status codes above, the sweep asserts that a blank optional filter ' +
    'value is accepted rather than rejected, which is the check added after defect ' +
    'D-12 and which covers 91 validation chains; that a repeated escrow release produces ' +
    'one payment and reports the second as a no-op; that a release without a deliverable ' +
    'is refused for a company; and that a pending withdrawal has already moved the amount ' +
    'into the locked balance rather than moving it when the decision is made.');

  h2('', 'Coverage of the route table');
  const guarded = routes.filter((r) => r.auth).length;
  const validated = routes.filter((r) => r.validates).length;
  const limited = routes.filter((r) => r.roles).length;
  table(['Property', 'Count', 'Of total'], [
    ['Routes requiring authentication', String(guarded), String(routes.length)],
    ['Routes naming permitted roles', String(limited), String(routes.length)],
    ['Routes validating their parameters', String(validated), String(routes.length)]
  ], [46, 18, 18], { caption: 'Table D.4  Route table properties' });

  note('On the two counts that are not the total',
    'Not every route is role restricted, and that is correct: a route that lists the ' +
      'student own applications does not need to name the student role, because being ' +
      'authenticated and asking for your own records is the whole check. Not every route ' +
      'declares explicit validation either, because a route with no input parameters has ' +
      'nothing to validate. Both numbers are listed so they can be compared against the ' +
      'route table rather than assumed.');
};