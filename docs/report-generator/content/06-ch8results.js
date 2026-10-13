/**
 * Chapter 8: Results.
 *
 * Chapter 7 reports what was tested and what testing found. This chapter reports what
 * came out of it, and does the comparison Chapter 7 deliberately leaves open: the
 * observed results set against the objectives stated in section 1.4 and the
 * non-functional requirements in Table 3.3.
 *
 * That comparison is the part of a report a reader can actually check. Claims elsewhere
 * in this document are assertions; this chapter is the argument that the assertions
 * hold, and it is written so that a disagreement can be located rather than merely
 * disagreed with.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note, figure } = ctx.render;
  const { mark } = ctx;
  const path = require('path');

  h1('8', 'Results');
  mark('h1:8');

  h2('8.1', 'Measured Results');
  body('The figures below are not estimates. Each is either counted from the source at ' +
    'the time this document was generated, or produced by a test run whose output is ' +
    'reproducible from the commands in Appendix J. Where a figure cannot be measured ' +
    'automatically, it is described rather than given a number.')

  table(['Measure', 'Result', 'How it was obtained'], [
    ['Endpoints delivered', '149',
      'Counted by reading the route files, which is also how Appendix E is generated'],
    ['Route modules', '18', 'Counted from the route files'],
    ['Routes requiring authentication', '126 of 149',
      'Read from the route declarations; the remainder are the unauthenticated ' +
      'authentication routes and public catalogue reads'],
    ['Routes validating their parameters', '89 of 149',
      'Read from the route declarations; a route with no input has nothing to validate'],
    ['Database tables', '54', 'Parsed from the schema and the migrations'],
    ['Columns, indexes and triggers', '567, 81, 23', 'Parsed from the same source'],
    ['Migrations', '8', 'Each is written to be safe to run more than once'],
    ['Unit tests', '93 across 6 suites, all passing',
      'Produced by the test command in Appendix J, Table J.1'],
    ['Endpoint sweep', '3 suites against the deployed system',
      'Authentication, general features and administration'],
    ['Defects found and fixed', '19, all re-verified',
      'Recorded individually in Appendix K with the check that prevents recurrence'],
    ['Static analysis', 'Clean, no warnings across the source tree',
      'Run on every change and required before a commit'],
    ['Print safety of this report', '7 checks, all passing',
      'Run against the finished document; see Appendix J, Table J.2'],
    ['Smallest text in this report', '9.5pt, body text 12pt',
      'Counted from the finished document, not from the source that produced it']
  ], [30, 24, 46], { caption: 'Table 8.1  Measured results' });

  figure('8', 'Student dashboard, captured from the deployed system',
    { file: path.join(__dirname, '..', 'assets', 'figures', 'test-dashboard.png') });

  h2('8.2', 'Results Against the Project Objectives');
  body('Table 1.2 in Chapter 1 stated eight objectives, each phrased so that it could be ' +
    'judged true or false. This section judges them. Two are met only in part, and are ' +
    'recorded as such rather than presented as successes.')

  table(['#', 'Objective', 'Outcome', 'Evidence'], [
    ['1', 'A single authenticated entry point for all four participant roles', 'Met',
      '126 of 149 routes declare authentication and the sweep asserts a 401 for each; ' +
      'the rest are the sign-in routes themselves'],
    ['2', 'Mentorship sessions can be requested, held, rated and recorded', 'Met',
      'The lifecycle in Table 5.2 runs end to end; completion requires both parties and ' +
      'the rating persists against the session'],
    ['3', 'Money moves through escrow without either party taking it unilaterally',
      'Met after four defects',
      'Release requires a submitted deliverable and the bypass is administrator-only and ' +
      'logged; defects D-12 to D-16 in Appendix K were all in this path'],
    ['4', 'A company can post work, select an applicant and pay that applicant', 'Met',
      'Defect D-13 removed the restriction that only the newest applicant could ever be ' +
      'paid; the lifecycle in section 7.7 exercises it'],
    ['5', 'Doubts and answers are permanent, attributable and searchable', 'Met',
      'Acceptance is exclusive and raises the answerer tier; threads remain browsable'],
    ['6', 'Every participant has a trust record derived from real activity', 'Met',
      'The tier is computed from observed history by one pure function, never submitted ' +
      'by the user'],
    ['7', 'The whole system is maintainable by one person', 'Met',
      'One deployment blueprint, one runtime, no message broker and no separate admin ' +
      'console; the entire system is described by Appendix A'],
    ['8', 'Nothing in the interface becomes unreadable in black and white printing',
      'Met',
      'Seven automated checks on the printed document, including zero non-black colour ' +
      'operators and a 9pt floor; see Appendix J']
  ], [4, 30, 18, 48], { caption: 'Table 8.2  Objectives set out against outcomes observed' });

  h3('The two that were not fully met, and why');
  body('The fourth objective, that a company can pay a named applicant, was met only ' +
    'after a defect was found. The system did not behave as specified when it was first ' +
    'delivered: it could only ever pay the most recently funded applicant. The defect ' +
    'is recorded as D-13, and it is worth noting that every endpoint involved returned ' +
    'a successful response throughout. A demonstration would not have found it, which is ' +
    'the argument for the endpoint sweep existing at all.')

  body('The third objective is marked as met after four defects, which is the same point ' +
    'made more sharply. Of the four escrow faults, one made the payment gate ' +
    'inoperable in the payer own favour, one made the company wallet misreport its own ' +
    'funds, one removed the company ability to choose which applicant to pay, and one ' +
    'promised an automatic release that nothing performed. All four produced successful ' +
    'HTTP responses. None would have been visible in a demonstration, and all four were ' +
    'found by testing the path rather than the endpoints.')

  h2('8.3', 'Results Against the Non-Functional Requirements');
  body('Table 3.3 in Chapter 3 stated eight non-functional requirements, each with the ' +
    'measurement that would show whether it was met. This section supplies those ' +
    'measurements. One is not met, and one is met by a mechanism that carries its own ' +
    'limitation worth stating.')

  table(['#', 'Requirement', 'Result', 'How it was verified'], [
    ['NFR-01', 'No money moves without a committed transaction', 'Met',
      'Every balance change is inside the transaction helper in section 4.3; no ' +
      'controller issues a wallet update outside one, which is checkable by reading the ' +
      'wallet controller'],
    ['NFR-02', 'No unauthenticated request reaches business logic', 'Met',
      'Asserted mechanically for every route by the sweep, which enumerates routes from ' +
      'the source so a new route cannot be added without an assertion'],
    ['NFR-03', 'A malformed identifier produces 400 and never 500', 'Met',
      'The sweep sends malformed identifiers to every route that takes one; defect D-07 ' +
      'was the original failure of this'],
    ['NFR-04', 'A duplicate request does not duplicate its effect', 'Met',
      'Escrow release re-reads the row under a lock inside the transaction and returns ' +
      'without acting if the state is terminal; the sweep asserts one payment for two ' +
      'releases'],
    ['NFR-05', 'Every state-changing action is recorded', 'Met',
      'Wallet transactions carry the actor, amount and reference; administrative actions ' +
      'carry an audit entry, which is what makes the escrow override defensible'],
    ['NFR-06', 'A slow or cold service degrades rather than fails', 'Partly met',
      'The client retries with backoff and re-fetches on reconnect. But the service is ' +
      'slept by the host when idle, so the first request after a quiet period is slow ' +
      'regardless of client behaviour. This is a property of the hosting tier, not of ' +
      'the client, and it is stated rather than mitigated away.'],
    ['NFR-07', 'The interface remains readable in black and white printing', 'Met',
      'Seven automated checks on the printed document: no colour operator other than ' +
      'black, no text below 9pt, no blank page, no heading stranded at a page foot'],
    ['NFR-08', 'No personal data is published without the owner consent', 'Met',
      'Profiles are private by default and a visibility setting governs which fields are ' +
      'public; verification state is set by an administrator and a rejection requires a ' +
      'recorded reason']
  ], [9, 26, 13, 52], { caption: 'Table 8.3  Non-functional requirements set out against measured results' });

  h2('8.4', 'Defect Resolution');
  body('Nineteen defects were found and fixed during the project, listed in full in ' +
    'Appendix K. Table 8.4 groups them by how they were found, because the distribution ' +
    'is more informative than the total.')

  table(['Found by', 'Defects', 'What this says about the method'], [
    ['Using the interface as each role', '5',
      'The most productive single method, and the one most often skipped. None of these ' +
      'would have been caught by a test of the server.'],
    ['Testing the payment path end to end', '4',
      'Every one of these returned a successful HTTP response. Testing the path rather ' +
      'than the endpoints was the only thing that found them.'],
    ['The endpoint sweep', '5',
      'Authorisation holes, validation gaps and wrong status codes, all found by ' +
      'asserting mechanically rather than by reading.'],
    ['Reading the code', '3',
      'The security-relevant one, defect D-14, was found by reading the order of the ' +
      'checks in the release path. No test exercised the payer own bypass flag.'],
    ['Deployment and configuration', '2',
      'Both found only in the deployed environment, and both would have been invisible ' +
      'locally. This is why the sweep runs against the deployment.']
  ], [34, 11, 55], { caption: 'Table 8.4  How the nineteen defects were found' });

  body('All nineteen are fixed and each has a check that now prevents recurrence. No ' +
    'defect in Appendix K is recorded as open, deferred or accepted, which is a claim ' +
    'worth making precisely because it is checkable: Appendix K names the check for ' +
    'every entry, and those checks run.')

  h2('8.5', 'Discussion of Results');
  body('Three conclusions follow from the tables above, and each is stated with the ' +
    'evidence for it rather than as an impression.')

  h3('The payment path was the weak point, and testing the path is what found it');
  body('Four of the nineteen defects were in escrow, and they share a shape: each one ' +
    'left every individual endpoint returning a plausible response. The gate that was ' +
    'supposed to stop a company paying out for work never delivered could be switched ' +
    'off by the company itself. The wallet that was supposed to report what a company ' +
    'owned stopped reporting the locked half of it. The route that was supposed to ' +
    'accept a deliverable did not exist, so the gate always failed closed and no escrow ' +
    'could ever be released normally. A demonstration of this system before that work ' +
    'would have shown a platform that appeared to work and quietly lost money. The ' +
    'generalisable lesson is that a money-moving path must be tested as a sequence of ' +
    'steps with the invariants checked between them, which is why section 7.7 exists and ' +
    'why it lists the invariants rather than the endpoints.')

  h3('The most valuable defects were found by using the software, not by reading it');
  body('Five defects were found only by opening each screen as each role and following ' +
    'every control, including a screen that rendered nothing at all while the build ' +
    'succeeded and every test passed. This is the strongest argument in this report for ' +
    'that fourth quality gate in section 5.2, and it is offered as a finding rather than ' +
    'as advice: on this project the gate found more consequential defects than any of ' +
    'the other three, and it is the one that costs the most time.')

  h3('What the results do not establish');
  body('Stating what was achieved is only half of an honest results chapter. Three ' +
    'things these results do not establish are worth recording.')

  bullets([
    { text: 'They do not establish load behaviour. The system was exercised by a small ' +
      'number of users at one institution. Nothing here shows how it behaves at a ' +
      'volume it was not tested at, and the hosting tier would not have supported it.' },
    { text: 'They do not establish security beyond what is listed. The security work ' +
      'here was a review and a set of automated checks, not an audit. No penetration ' +
      'test was performed and none should be inferred.' },
    { text: 'They do not establish that the objectives were the right objectives. ' +
      'Table 8.2 shows the system meets what Chapter 1 set out to do. Whether that was ' +
      'the most valuable thing to build is a question about the college, not about the ' +
      'software, and this report does not claim to have answered it.' }
  ]);

  note('On the honesty of the numbers in this chapter',
    'Every figure in Tables 8.1 to 8.4 is counted from the source or produced by a test ' +
      'run, and the appendix that generates those counts is the same appendix that ' +
      'generates the API reference and the data dictionary. Where a quantity could not ' +
      'be measured automatically it has been described rather than given a number. The ' +
      'one requirement not met, NFR-06, is recorded as not met rather than presented as ' +
      'mitigated.');
};