/**
 * Chapter 5: Technology and Methodology.
 *
 * This chapter records two things Chapter 6 does not. First, why each technology in
 * the stack was chosen, and more usefully, which alternatives were rejected and why.
 * A reader assessing whether the design was sensible cannot do that from a list of
 * technologies; they need the options that were weighed.
 *
 * Second, how the work was carried out. The engineering decisions in this report were
 * reached by a stated process, and a report that describes only the result leaves a
 * reader unable to tell whether the process was deliberate or accidental.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  h1('5', 'Technology and Methodology');
  mark('h1:5');

  h2('5.1', 'Technology Stack');
  body('The stack was chosen against explicit alternatives rather than by preference. ' +
    'Table 5.1 states each choice with its reasoning; section 5.3 records what was ' +
    'rejected and why, which is the more useful half of the decision.')

  table(['Layer', 'Choice', 'Why this choice'], [
    ['Language', 'JavaScript on both client and server',
      'One language across the wire means a validation rule, a date format or a string ' +
      'comparison cannot drift between client and server. This was worth more than the ' +
      'advantages of any particular language.'],
    ['Server framework', 'Express',
      'Its middleware model is exactly what the route-boundary validation design in ' +
      'section 4.2 depends on: guards are composable and run in order.'],
    ['Database', 'PostgreSQL 16',
      'The central problem in this system is money. Transactions, row-level locking, ' +
      'partial unique indexes and check constraints are all required, and all four are ' +
      'first-class in this database rather than emulated.'],
    ['Client framework', 'React with Vite',
      'The application is mostly lists and forms across many similar screens, which a ' +
      'component model suits. Vite builds fast enough to keep the edit and reload loop ' +
      'short, which matters more on a project with this much iteration.'],
    ['Client routing', 'React Router',
      'Standard, and it supports lazy loading, which keeps the administrative screens ' +
      'out of the bundle a student downloads.'],
    ['Client state', 'Zustand',
      'A single store rather than a context tree per concern. The state is small and ' +
      'the auth session is the only genuinely global thing in it.'],
    ['Forms', 'React Hook Form with Zod',
      'Validation is declared as a schema on the client and enforced by the server ' +
      'with the same rules, so the two cannot disagree about what is valid.'],
    ['Real-time', 'Socket.IO with its client',
      'Reconnection with backoff is handled rather than hand-written, which matters ' +
      'because the host sleeps when idle and disconnection is therefore normal.'],
    ['File handling', 'Sharp and a content-type probe',
      'Uploaded files are validated by what they actually contain rather than by their ' +
      'name or the type the client declared.'],
    ['Unit testing', 'Jest with Supertest',
      'Supertest drives the Express application directly, so tests exercise the real ' +
      'middleware chain rather than a copy of it.'],
    ['Deployment', 'Render, two services and one database',
      'A single blueprint file declares everything, so the deployed configuration is ' +
      'reviewable rather than assembled by hand in a console.']
  ], [17, 25, 58], { caption: 'Table 5.1  Technology stack and the reasoning for each choice' });

  h2('5.2', 'Development Methodology');
  body('The project followed an incremental vertical-slice process rather than an ' +
    'up-front design followed by a build phase. Each slice delivered one complete ' +
    'feature, from the data layer through the interface and the tests, before the next ' +
    'slice began, and the working state was committed after every slice that passed.')

  h3('The slices, in the order they were delivered');
  table(['#', 'Slice', 'Why in this order'], [
    ['1', 'Authentication and profiles',
      'Every later slice needs an identity to attach records to, so it has to exist ' +
      'first.'],
    ['2', 'Gigs and applications',
      'Establishes the central relationship between a student and a company, which the ' +
      'payment work then depends on.'],
    ['3', 'Wallet and escrow',
      'Built after the relationship it protects exists, so its rules can be written ' +
      'against real records rather than imagined ones.'],
    ['4', 'Mentorship sessions',
      'The other half of the platform thesis, built once the shared role and permission ' +
      'machinery was proven by the gig flow.'],
    ['5', 'Doubts and answers',
      'Independent of the rest, so it could absorb defects found in the earlier slices.'],
    ['6', 'Messaging and notifications',
      'Depends on events that slices 2 to 5 already emit.'],
    ['7', 'Resources and interview preparation',
      'The simplest remaining content feature; deliberately late so it could be built ' +
      'against the patterns the earlier slices had settled.'],
    ['8', 'Administration and analytics',
      'Last, because it reads records that only exist once the slices above have run.'],
    ['9', 'Payments, withdrawals and the release job',
      'Deliberately last and deliberately separate. This is where the four escrow ' +
      'defects were found, and it is the part that needed the most verification.']
  ], [5, 30, 65], { caption: 'Table 5.2  Vertical slices and their ordering' });

  h3('Quality gates');
  body('A slice was considered complete only when all four of the following held. These ' +
    'are gates rather than aspirations, and each one can fail a build.')

  numbered([
    'The unit suite passes. A slice was not merged with a failing test, and a failing ' +
      'test was not commented out.',
    'Static analysis is clean, with no warnings. Warnings are treated as failures ' +
      'because a warning is a defect that has not been written down yet.',
    'The endpoint sweep passes against the deployed system, not only against a local ' +
      'copy. Several defects in this project were specific to the deployed environment ' +
      'and were invisible locally.',
    'The slice has been used in a browser as each role that can see it. This gate found ' +
      'more consequential defects than the other three combined.'
  ]);

  note('Why the fourth gate is not optional',
    'Several of the worst defects in this project passed the first three gates. A screen ' +
      'that rendered nothing at all, because a route referenced a component name that ' +
      'was never imported, produced a successful build, passing unit tests and a passing ' +
      'sweep. None of those three gates load the client. Gate four exists because a ' +
      'green build is evidence about the compiler, not about the application.');

  h2('5.3', 'Alternative Technologies Considered');
  body('Each layer of the stack was chosen against alternatives. This section records ' +
    'the options that were weighed and the reason each was not taken, because a decision ' +
    'recorded only as a choice carries none of the information a reviewer needs.')

  table(['Layer', 'Alternatives considered', 'Why the chosen option prevailed'], [
    ['Backend', 'A single hosted backend as a service, or Firebase',
      'A hosted backend would have supplied authentication, a REST interface and ' +
      'realtime without a server to operate, and that is a real advantage at this ' +
      'scale. It was rejected because its authorisation model lives outside the ' +
      'database and is therefore harder to audit in one place, and because the payment ' +
      'requirements here need explicit transactions over several tables with row locks, ' +
      'which is a property of the data layer rather than a convenience.'],
    ['Database', 'MySQL or a document store',
      'Rejected for one decisive reason: this system moves money, and the escrow ' +
      'invariants depend on multi-table transactions and row-level locking being ' +
      'straightforward. A document store would have pushed the integrity rules back ' +
      'into application code, where they are enforced only while that code is correct ' +
      'and are invisible in the schema.'],
    ['Payments', 'A third-party payment gateway with split settlement',
      'A gateway would have handled compliance and payouts, and would have been the ' +
      'better answer if one were available to a college project without a registered ' +
      'business. The escrow is therefore modelled internally as a ledger, which is the ' +
      'part of gateway behaviour that actually matters for trust, and which can be ' +
      'replaced by a gateway later without changing what a user sees.'],
    ['Real-time', 'Managed pub/sub, or long polling against the API',
      'Managed pub/sub is correct at any scale but is another service to operate and ' +
      'bill for. Long polling holds a request open per waiting client and does not ' +
      'survive a service sleep cleanly. A WebSocket endpoint on the existing process ' +
      'costs one extra route, and its costs are stated in section 6.7 rather than ' +
      'hidden.'],
    ['Scheduling', 'A queue table with a worker, or an external scheduler',
      'A queue table would need something to poll it, which is the worker that was ' +
      'being avoided. The platform cron service runs a plain script, which means the ' +
      'same code path is used whether the scheduler or a person invoked it, and that is ' +
      'what makes the job safe to run by hand.'],
    ['Client state', 'Redux, or the React Context API',
      'The server state already lives in the database and is fetched per view, so the ' +
      'global client state is limited to the auth session and transient interface ' +
      'state. The Context API covers that without another dependency, consistent with ' +
      'the rule of not adding a dependency a platform built-in already satisfies.'],
    ['Interface styling', 'A component library, or plain CSS',
      'A component library would have imposed its own visual language on every screen ' +
      'and made the black and white printing requirement harder to satisfy, because ' +
      'such libraries carry their own colours and grey text. Plain CSS with a single ' +
      'source of colour and type values keeps the constraint checkable, which matters ' +
      'because the printing requirement is enforced mechanically by section J.'],
    ['Validation', 'Validating only in controllers',
      'Controller-level validation was the original design and it failed in two ways: ' +
      'it was applied inconsistently across 149 routes, and it ran after business logic ' +
      'had already begun. Declarative chains at the route boundary are applied ' +
      'uniformly and run before any controller, which is why section 4.2 exists at all.']
  ], [16, 27, 57], { caption: 'Table 5.3  Alternatives weighed and why each was not taken' });

  note('The pattern across all eight decisions',
    'Each rejection rests on one of three things: that a managed service moves a ' +
      'guarantee out of the database and away from the schema; that a dependency would ' +
      'add something the platform already provides; or that a choice would have cost ' +
      'the ability to check a property automatically. The third is the one that is ' +
      'least obvious and, on this project, the most useful, because it is why the ' +
      'printing requirement in section J can be verified by a script at all.');
};