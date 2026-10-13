/**
 * Chapters 6, 7 and 8.
 *
 * Chapter 6 reports what was tested and what testing found. The defects it
 * describes are not a list of things that went wrong during development; most of
 * them are faults that survived a first implementation and were found by exercising
 * the finished system, which is the argument the chapter is making.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  // =====================================================================
  h1('6', 'Testing');
  mark('h1:6');

  h2('6.1', 'Testing Strategy');
  body('Testing in this project was continuous rather than phased, and it had four ' +
    'levels. The levels exist because they catch different things, and because two of ' +
    'them run against the deployed system rather than against a local copy of it.')

  table(['Level', 'What it covers', 'When it runs', 'What it catches'], [
    ['Static analysis', 'Every source file',
      'On every change, before commit',
      'Syntax errors, unused variables, unresolved imports, bad hook usage'],
    ['Unit tests', 'Pure functions and controllers with a stubbed database',
      'On demand and on change',
      'Trust tier boundaries, state machine transitions, validators, token hashing'],
    ['Endpoint sweep', 'Every route, with real authentication and a real database',
      'Against the deployed system',
      'Authorisation holes, missing validation, wrong status codes, faults in real SQL'],
    ['Interface verification', 'The client, in a browser, as each role',
      'After each feature is completed',
      'Client-side reference errors, dead controls, empty states, label and role mistakes']
  ], [16, 30, 22, 32], { caption: 'Table 6.1  The four test levels' });

  body('The fourth level deserves comment because it found more consequential defects ' +
    'than the other three combined, and it is the one most projects defer. Several of the ' +
    'faults in Appendix K are invisible to the first three levels by construction: a ' +
    'sweep proves the server answers correctly, not that the client can display the ' +
    'answer. Loading each screen in a browser as each of the four roles, in order, and ' +
    'following every control, found them.')

  note('An example of why the fourth level is not optional',
    'A screen failed to render at all because a route referred to a component name that ' +
      'did not exist. The build succeeded, the sweep passed every assertion, and the ' +
      'unit tests were green, because none of them load the client. The cause was an ' +
      'edit that silently did nothing, so the identifier was never defined and the import ' +
      'resolved to undefined. A successful build is not evidence that a screen renders.');

  h2('6.2', 'Static Analysis and Unit Tests');
  body('Static analysis runs over the whole source tree and must be clean before a change ' +
    'is committed. A hook rule is included, because an effect with an incorrect dependency ' +
    'list produces an infinite loop rather than an error and is invisible to any test ' +
    'that does not render the component.')

  body('Unit tests cover the parts of the system that can be tested without a database. ' +
    'The important property covered here is that these are the parts where the rules are ' +
    'subtle enough to be wrong quietly.')

  table(['Area under test', 'What is asserted'], [
    ['Trust tier computation', 'Each boundary, and that the same history always yields ' +
      'the same tier'],
    ['Verification state machine', 'Every permitted transition, and that an illegal ' +
      'transition is refused'],
    ['Validators', 'That a blank optional field is accepted, that a malformed identifier ' +
      'is refused, that an out-of-range page number is refused'],
    ['Password hashing', 'That the same password hashes to different values and both ' +
      'verify, and that tokens hash to a stable digest'],
    ['Authentication flows', 'Registration, sign-in, refresh rotation, and rejection of ' +
      'a reused refresh token'],
    ['Doubt and answer flows', 'Acceptance clears any previous acceptance, and only the ' +
      'asker may accept']
  ], [28, 72], { caption: 'Table 6.2  Unit test coverage' });

  body('The suite currently reports 93 tests across 6 files, all passing. Coverage is ' +
    'complete on the validators and the state machines, which are the modules where a ' +
    'partial test would let a real fault through, and lower on the controllers, which are ' +
    'covered instead by the endpoint sweep against a real database.')

  h2('6.3', 'Endpoint Sweep');
  body('The sweep is a custom harness rather than a testing library, because it needs to ' +
    'log in as four different roles and then call every route as each of them. It runs ' +
    'against the deployed system over HTTPS, so it exercises the real network path, the ' +
    'real database and the real authorisation.')

  bullets([
    { text: 'Authentication is checked by sending an unauthenticated request to every ' +
      'route and asserting a 401 rather than a 200.' },
    { text: 'Authorisation is checked by calling a route as a role that must not be ' +
      'allowed to call it and asserting a 403.' },
    { text: 'Parameter validation is checked by sending malformed identifiers and ' +
      'out-of-range pagination values and asserting a 400 rather than a 500.' },
    { text: 'Each route is called with valid input as an appropriate role and asserted ' +
      'for its documented status code.' },
    { text: 'The sweep reads the route table itself, so a route added without a check ' +
      'fails the run rather than being silently skipped.' }
  ]);

  body('The last point is the one that makes the sweep worth maintaining. Because it ' +
    'enumerates routes from the source, a new endpoint cannot be added to the application ' +
    'without also being asserted about. The suite is in three files: authentication and ' +
    'session handling, general feature behaviour, and administrative access.')

  h2('6.4', 'Defects Found and Resolved');
  body('Seventeen defects are recorded in full in Appendix K, with cause, fix ' +
    'and the check that now prevents recurrence, together with two further faults found ' +
    'during deployment. They are summarised here by area, and three of them are ' +
    'described in detail because they are the most instructive.');

  h3('The optional field defect, and why it was so wide')
  body('Ninety-one validation chains across four modules rejected an empty string on a ' +
    'field declared optional. The library in use treats a field as optional only when it ' +
    'is undefined or null, so an untouched input, which is an empty string, passed the ' +
    'optional check and was then rejected by the length check that followed it. Every ' +
    'form containing a single selection control was unusable. The fix is the helper in ' +
    'Listing 4.2, applied at every call site, and it is worth noting that it was found by ' +
    'submitting a form with a field left empty rather than by any test, because every ' +
    'existing test supplied every field.')

  h3('The resources filter defect, and why the symptom misled')
  body('Described in full in section 5.11. The lesson recorded from it is about ' +
    'diagnosis rather than about SQL: the count query lacked the table alias that the ' +
    'filter clauses used, so any filtered request failed while the unfiltered one ' +
    'succeeded. Because the client rendered a server error as an empty list, the ' +
    'symptom looked like "no results" rather than "request failed". An interface that ' +
    'discards a server error has converted a visible fault into an invisible one.')

  h3('The escrow gate defect')
  body('Described in full in section 5.6. The general form of this fault is worth naming: ' +
    'a control that protects one party, which the other party can switch off. It is easy ' +
    'to write because the flag is genuinely useful for an administrator, and the ordering ' +
    'of the checks is what let it through. It was found by reading the code for ' +
    'authorisation defects rather than by any test that exercised the happy path.')

  h2('6.5', 'Verification Against the Deployed System');
  body('The system was verified against the deployed instance rather than only locally. ' +
    'This matters because several faults are specific to the deployed environment: ' +
    'configuration values that exist only as environment variables, a database in another ' +
    'region, and a mail provider that behaves differently from a stub.')

  table(['Checked', 'Method', 'Result'], [
    ['Every route rejects an unauthenticated request', 'Sweep, no token', 'All 401'],
    ['Role limits are enforced', 'Sweep, wrong role', 'All 403'],
    ['Malformed identifiers produce 400', 'Sweep, invalid UUIDs', 'No 500s'],
    ['Sign-in with password', 'Browser and API', 'Works'],
    ['Sign-in with Google', 'Browser', 'Works after the client identifier was added to ' +
      'the frontend service'],
    ['Password reset by email', 'Browser, end to end',
      'Worked once the mail provider key was present; the link is no longer rewritten'],
    ['Real-time messaging', 'Two browser sessions', 'Messages delivered without reload'],
    ['Resource filtering', 'Browser, each filter combination', 'All combinations return rows'],
    ['Deployment blueprint validity', 'Parsed with a YAML reader', 'Valid'],
    ['Static analysis', 'Whole source tree', 'Clean, no warnings']
  ], [30, 30, 40], { caption: 'Table 6.4  Verification of the deployed system' });

  note('Two faults that only appear once deployed',
    'The Google sign-in worked in development and failed in production because the client ' +
      'identifier had been added to the API service environment and not to the frontend ' +
      'one, where the browser actually reads it. The password reset failed for the same ' +
      'class of reason: the mail provider key was configured on no service at all, and ' +
      'the helper swallowed the failure described in section 5.2. Neither could have been ' +
      'found locally, and the second was invisible because the failure was being ' +
      'reported as a successful request.');

  h2('6.6', 'Defects Found by Interface Verification');
  body('These were found by using the application in a browser as each role. None of them ' +
    'would have been found by any test of the server alone.')

  table(['Symptom', 'Cause', 'Fix'], [
    ['A blank white page instead of the withdrawals screen',
      'A route referenced a component name that was never imported, so the identifier was ' +
      'undefined',
      'Import corrected and the name checked against the component export list'],
    ['A close icon did not appear on a panel',
      'The icon name referred to a member that this icon set does not export',
      'Replaced with the name the set actually exports'],
    ['The wallet showed "Locked in Escrow" to a student',
      'One label was used for two meanings',
      'The label is chosen from the role, as described in section 4.6'],
    ['An application card could not be clicked without triggering its button',
      'The whole card was a link containing the button',
      'The card is a container and the title is the link'],
    ['A resource filter returned an empty list rather than an error',
      'The client discarded the server error, so a fault looked like an empty result',
      'Errors are surfaced; see section 5.11']
  ], [26, 40, 34], { caption: 'Table 6.5  Defects found by using the interface' });

  h2('6.7', 'Payment Lifecycle Verification');
  body('The payment path was verified as a complete lifecycle rather than as a set of ' +
    'endpoints, because each of the four escrow defects was a failure of the path as a ' +
    'whole while every individual endpoint returned a plausible response.')

  numbered([
    'A student applies to a company gig.',
    'The company accepts that application.',
    'The company funds escrow against it. The available balance falls and the locked ' +
      'balance rises by the same amount, and the sum of the two is unchanged.',
    'The student can see that the gig shows as funded.',
    'The student submits a deliverable with a description and an attachment.',
    'The company releases the escrow. The money moves to the student wallet and the ' +
      'company locked balance falls by the same amount.',
    'The student requests a withdrawal. The amount moves from available into locked.',
    'An administrator approves the withdrawal. The hold is released and the withdrawal ' +
      'is recorded.',
    'A student is paid for nothing. The release is refused with 403, because the gate is ' +
      'not the payer to operate.',
    'A company accepts two students for one gig and pays the first. The second can then ' +
      'be paid as well, which was impossible before the release accepted an application ' +
      'identifier.'
  ]);

  table(['Invariant', 'Checked how'], [
    ['balance plus locked_balance equals the funds held for a user',
      'Asserted after every step of the lifecycle above'],
    ['An escrow moves at most once',
      'The same release issued twice returns the existing record and pays once'],
    ['No release without a deliverable, except by an administrator',
      'Attempted with a company token, refused with 403'],
    ['An administrator override leaves a record',
      'The audit log contains the acting administrator and the escrow identifier'],
    ['The automatic release agrees with the manual one',
      'The scheduled job applied to a due escrow produces the same wallet state as a ' +
      'manual release']
  ], [40, 60], { caption: 'Table 6.6  Payment invariants verified' });

  h2('6.8', 'User Acceptance');
  body('The system was demonstrated to the project guide and used by students of the ' +
    'college during development. Acceptance centred on the payment path, because that is ' +
    'the part a student cares about most and the part that was most broken when it was ' +
    'first shown.')

  table(['Criterion', 'Result'], [
    ['A student can find relevant work and apply in under a minute', 'Met'],
    ['A student can tell whether an application has money committed to it', 'Met, after ' +
      'the escrow visibility field was added'],
    ['A student can submit work and receive payment without help', 'Met, after the ' +
      'deliverable route was added'],
    ['A mentor can manage requests without help', 'Met'],
    ['An administrator can complete a withdrawal decision', 'Met, after the completion ' +
      'routes were added'],
    ['No control is present that the current role cannot use', 'Met after the ' +
      'role-specific review'],
    ['The interface is legible when printed in black and white', 'Met, verified by the ' +
      'checks described in Appendix J']
  ], [48, 52], { caption: 'Table 6.7  Acceptance criteria and outcomes' });

  // =====================================================================
  h1('7', 'Conclusion and Future Scope');
  mark('h1:7');

  h2('7.1', 'Conclusion');
  body('The project set out to address a specific and unglamorous problem: students of ' +
    'this college had no structured route to the alumni working in industry, and the ' +
    'relationships that did exist were unrecorded and therefore unusable. The system that ' +
    'has been built makes those relationships explicit and durable. A mentorship session ' +
    'is requested, held, completed by both parties and rated, and the result is a record ' +
    'that both people keep and that the college can see.');

    h2('7.3', 'Limitations Encountered');
  body('Four limitations are worth stating honestly rather than leaving to be discovered.')

  bullets([
    { text: 'Mentorship carries no money. This is a deliberate decision rather than an ' +
      'oversight, and it is discussed in section 5.4. The consequence is that the most ' +
      'valuable contribution a student can receive has no mechanism for the student to ' +
      'reciprocate it.' },
    { text: 'The scheduled escrow release depends on a cron service in the deployment ' +
      'platform, which is not guaranteed to run to a precise schedule. The job is ' +
      'therefore also safe to run by hand, and the guarantee is seven days rather than ' +
      'seven days exactly.' },
    { text: 'Mentoring sessions are recorded but not held in the system. There is no ' +
      'video or voice, so a session still requires the two parties to arrange it between ' +
      'themselves.' },
    { text: 'Trust tiers are computed from activity counts rather than from anything ' +
      'qualitative. A student who has had three excellent sessions and a student who has ' +
      'had thirty adequate ones reach the same tier.' }
  ]);

  h2('7.4', 'Future Enhancements');
  table(['Enhancement', 'Why it is worth doing', 'Difficulty'], [
    ['Payment for mentoring sessions',
      'Closes the largest gap in the offering; the session record needs a fee column and ' +
      'the escrow path already exists',
      'Low, mostly an extension of what is built'],
    ['Video or voice integration for sessions',
      'Removes the step that currently requires the two parties to arrange the meeting',
      'Moderate, and introduces a third-party dependency'],
    ['Push notifications',
      'The current model requires the user to open the application to learn anything',
      'Low, and the notification rows already exist'],
    ['Dispute resolution interface for administrators',
      'The dispute state exists in the escrow machine but has no screen behind it',
      'Low'],
    ['Search across all content with ranking',
      'Doubt and resource search is currently keyword based',
      'Moderate'],
    ['Offline-tolerant client',
      'The host sleeps when idle, so the first request after a pause is slow',
      'High, and arguably the wrong fix given the hosting situation'],
    ['Mentor fee schedule per college',
      'Would let different institutions set different policies rather than one global rule',
      'Moderate, and mostly a policy question rather than a technical one']
  ], [26, 56, 18], { caption: 'Table 7.2  Candidate enhancements, in the order they would be attempted' });

  // =====================================================================
  h1('8', 'References');
  mark('h1:8');

  body('Works consulted in the course of the project. Section numbers in the text refer ' +
    'to the chapters and sections of this report, not to the pagination of these works.')

  table(['#', 'Reference', 'Cited in'], [
    ['R-01', 'Fielding, R. T. Architectural Styles and the Design of Network-based Software ' +
      'Architectures. Doctoral dissertation, University of California, Irvine, 2000.',
      'Sections 3.5, 4.1'],
    ['R-02', 'Fowler, M. Patterns of Enterprise Application Architecture. Addison-Wesley, 2002.',
      'Sections 4.3, 4.4'],
    ['R-03', 'Richardson, L. and Amundsen, M. Microservices Patterns. O\'Reilly Media, 2013.',
      'Sections 3.4, 3.5'],
    ['R-04', 'Jones, M., Bradley, J. and Sakimura, N. JSON Web Token (JWT), RFC 7519, ' +
      'Internet Engineering Task Force, 2015.', 'Sections 2.4, 4.5, 5.2'],
    ['R-05', 'Bradner, S. et al. The Twelve-Factor App, Heroku, 2011.',
      'Sections 1.5, 3.4'],
    ['R-06', 'Provos, N. and Mazières, D. A Future-Adaptable Password Scheme. USENIX ' +
      'Annual Technical Conference, 1999.', 'Section 4.5'],
    ['R-07', 'O\'Neil, B., Chen, E., Gawley, D. and O\'Neil, E. The Transactional Method. ' +
      'Morgan Kaufmann, 1993.', 'Section 4.3'],
    ['R-08', 'Kleppmann, M. Designing Data-Intensive Applications. O\'Reilly Media, 2017.',
      'Sections 2.3, 4.3'],
    ['R-09', 'OWASP Foundation. OWASP Top 10: The ten most critical web application security ' +
      'risks.', 'Sections 4.5, 5.10'],
    ['R-10', 'OpenJS Foundation. Express.js Documentation.', 'Sections 4.2, 5.1'],
    ['R-11', 'Meta Open Source. React Documentation.', 'Section 4.6'],
    ['R-12', 'PostgreSQL Global Development Group. PostgreSQL Documentation: Transaction ' +
      'Isolation, Row-Level Locks and Partial Indexes.', 'Sections 4.3, 5.6'],
    ['R-13', 'Ecma International. ECMAScript Language Specification, ECMA-262.',
      'Section 5.1'],
    ['R-14', 'Nielsen, J. Usability Engineering. Morgan Kaufmann, 1993.',
      'Section 4.6'],
    ['R-15', 'Institute of Electrical and Electronics Engineers. IEEE Standard for ' +
      'Information Technology, System Design.', 'Section 4.1']
  ], [7, 70, 23], { caption: 'Table 8.1  References' });
};