/**
 * Chapters 1 and 2.
 *
 * Chapter 1 establishes what was built and why. Chapter 2 reviews the existing
 * work the design answers to, and ends by converting that review into named
 * design decisions, so the survey is not a list of references but the reason
 * the architecture in Chapter 4 looks the way it does.
 */
module.exports = (ctx) => {
  const { h1, h2, h3, body, bullets, numbered, table, code, note } = ctx.render;
  const { mark } = ctx;

  // =====================================================================
  h1('1', 'Introduction');
  mark('h1:1');

  // ---------------------------------------------------------------- 1.1
  h2('1.1', 'Project Overview');
  body('NextGen Campus is a web platform that connects three groups who currently have no ' +
    'shared system between them: students of a college, companies that offer short paid ' +
    'work to those students, and alumni who are willing to give time to guide them. The ' +
    'platform is built around the assumption that the scarce resource in a tier two or tier ' +
    'three college is not ability but access, and that access is held by the alumni network ' +
    'of that specific institution rather than by any system a student can log into.');

  body('The system is therefore not a job board. A job board lists opportunities that are ' +
    'open to anyone, which means a student of this college competes on the same terms as a ' +
    'graduate of a university several hundred times its size, with nothing to distinguish ' +
    'them. NextGen Campus instead makes the relationship itself the product. An alumnus ' +
    'publishes availability, a student requests a session, the session is held in the system, ' +
    'the student rates it, and the ratings accumulate into a visible trust record that both ' +
    'sides can rely on in later transactions.');

  body('Around that core the platform carries the surrounding activity a campus actually ' +
    'has: doubts and answers, gigs and applications, escrow and payments, messages and ' +
    'notifications, a resource library, and an administrative layer for verification and ' +
    'moderation. It serves four roles, each with its own view of the same data: student, ' +
    'company, mentor and administrator.');

  table(['Layer', 'Technology', 'Responsibility'], [
    ['Presentation', 'React 18 with Vite, Tailwind, React Router',
      'Screens, forms, client state. No server-side rendering, because every screen sits ' +
      'behind authentication.'],
    ['Application', 'Node.js, Express, Socket.IO',
      '149 HTTP endpoints across 18 route modules, plus the real-time channel.'],
    ['Data', 'PostgreSQL 16',
      '54 tables, 567 columns, 81 indexes and 23 triggers. All money movement is ' +
      'transactional.'],
    ['Infrastructure', 'Render, Supabase-hosted PostgreSQL, SendGrid, Redis',
      'Two web services and one database, deployed from a single blueprint file.']
  ], [16, 30, 54], { caption: 'Table 1.1  Technology stack by layer' });

  // ---------------------------------------------------------------- 1.2
  h2('1.2', 'Problem Statement');
  body('The problem addressed by this project is not a shortage of opportunity. It is that ' +
    'the connections which would create opportunity are informal, unrecorded and ' +
    'invisible to everyone outside them.');

  numbered([
    'Students have no structured route to the alumni of their own institution. The route ' +
      'that exists is a personal contact, usually on a messaging application, and it is ' +
      'invisible to the college, unverifiable, and lost when that person changes number.',
    'Companies cannot find students from this college without going through a public job ' +
      'board, on which they compete with thousands of other listings for the same small ' +
      'pool of attention.',
    'Short paid work has no mechanism to protect either side. A student who is asked to do ' +
      'a piece of work has no way to be made to deliver; a company that pays up front has no ' +
      'way to recover the money if it is not.',
    'Answers to academic doubts are scattered across chat groups and are usually lost. ' +
      'Nothing is attributable, nothing is searchable afterwards, and the same question is ' +
      'asked again each semester.',
    'Nothing that happens on the platform can be trusted later. There is no record of who ' +
      'did what, when, or whether the work was acceptable, so a good student and a good ' +
      'alumnus cannot build on a single successful interaction.'
  ]);

  body('These are related failures rather than separate ones. Each of them is the same ' +
    'underlying problem seen from a different side: the absence of a shared, durable record ' +
    'that all the parties can rely on. A platform that adds a job board without adding that ' +
    'record would reproduce the weakness it was built to remove.');

  h3('The central difficulty');
  body('Money is what makes this hard. Every other feature in the system is a matter of ' +
    'storing rows and rendering them. The payment path requires that funds be held ' +
    'somewhere the platform controls until a condition is met, that releasing them is ' +
    'atomic, and that no party can release them unilaterally for their own benefit. That ' +
    'requirement is what shaped the database design in section 4.3 and is the reason the ' +
    'escrow module is treated as the most safety-critical part of the system in Chapter 6.');

  // ---------------------------------------------------------------- 1.3
  h2('1.3', 'Proposed Solution');
  body('The proposed solution keeps the alumni relationship at the centre and builds the ' +
    'rest of the system around the record it produces. Four mechanisms do the work.');

  h3('Mentorship sessions with a durable record');
  body('An alumnus publishes that they are available. A student sends a request naming a ' +
    'topic. The mentor accepts, declines or reschedules. The session is held with a start ' +
    'time and a duration, both parties can mark it complete, and the student then rates ' +
    'it on a defined scale. The completed session, its rating and the topic discussed are ' +
    'stored permanently and appear on both profiles. This is the primitive that the ' +
    'platform is built around: after a hundred of them, a student has a demonstrable ' +
    'record of having been helped, and an alumnus has one of having helped.');

  h3('Escrow-backed gigs');
  body('A company posts a gig with a stated budget. A student applies. If the company is ' +
    'satisfied it funds an escrow, which moves the money from the company available balance ' +
    'into a locked balance at the same instant. The student sees the money is committed, ' +
    'does the work and submits a deliverable. The company then either releases the escrow ' +
    'to the student or refunds it. If neither party acts, a scheduled job releases it ' +
    'automatically after seven days. At no point does the platform hold the money as ' +
    'revenue, and at no point can the paying party release the money without a deliverable ' +
    'unless an administrator intervenes.');

  h3('Public doubts and answers');
  body('A student posts a doubt with a subject and a level. Any authenticated user may ' +
    'answer. Answers may be marked accepted by the asker, which raises the answerer trust ' +
    'tier, and the whole thread remains searchable. Doubt activity is also the main source ' +
    'of the analytics the college is shown about which subjects its students struggle with.');

  h3('Trust scores built from observed behaviour');
  body('Rather than asking users to rate themselves, the platform derives trust from what ' +
    'actually happened: sessions completed and rated, answers accepted, escrow released ' +
    'without dispute, resources uploaded and approved. A tiering function maps that ' +
    'history onto a small number of named tiers, and the mapping is implemented as a ' +
    'single pure function so that the same history always produces the same tier.');

  note('Why the escrow model is escrow and not a direct transfer',
    'A direct transfer would require the student to trust the company or the company to ' +
    'trust the student, and in practice neither party trusts a stranger on a website they ' +
    'both use for the first time. Holding the money removes the need for that trust, which ' +
    'is the only reason the exchange is possible at all for a first transaction between ' +
    'two people who have never met.');

  // ---------------------------------------------------------------- 1.4
  h2('1.4', 'Objectives');
  body('The project set out with the following objectives. Each is stated so that it can be ' +
    'judged true or false against the finished system, and the evidence for each is given ' +
    'in Chapter 7.')

  table( ['#', 'Objective', 'How it is judged'], [
    ['1', 'Provide a single authenticated entry point for all four participant roles',
      'Every route is behind authentication; unauthenticated requests are rejected with 401.'],
    ['2', 'Make it possible to request, hold, rate and record a mentorship session',
      'The complete session lifecycle runs from request to rating with no manual step.'],
    ['3', 'Move money through escrow without allowing either party to take it unilaterally',
      'Release requires a submitted deliverable; the bypass is restricted to administrators.'],
    ['4', 'Allow a company to post work, select an applicant, and pay that applicant',
      'A gig with several accepted applicants can pay any one of them by identifier.'],
    ['5', 'Make doubts and answers permanent, attributable and searchable',
      'Accepted answers raise the answerer tier; the thread remains browsable afterwards.'],
    ['6', 'Give every participant a visible trust record derived from real activity',
      'Trust tiers are computed from observed history by one pure function.'],
    ['7', 'Keep the whole system maintainable by one person',
      'No client-side server rendering, no message broker, one deployment blueprint.'],
    ['8', 'Guarantee that nothing in the interface becomes unreadable in black and white',
      'Every page uses pure black on white, no text below 9pt, and borders rather than shading.']
  ], [5, 44, 51], { caption: 'Table 1.2  Project objectives and their evidence' });

  // ---------------------------------------------------------------- 1.5
  h2('1.5', 'Scope and Limitations');
  body('The system as built is a complete, working platform rather than a prototype, but it ' +
    'is bounded in ways that are worth stating plainly, because several of them are ' +
    'consequences of the deployment environment rather than of the design.')

  h3('Deliberate exclusions');
  bullets([
    { text: 'No native mobile application. The single page application is responsive, but ' +
      'there is no packaged build and no store distribution.' },
    { text: 'Mentorship is unpaid. Sessions are recorded and rated, but there is no money ' +
      'path for mentors. This is a deliberate choice: paying alumni introduces a ' +
      'taxation and compliance obligation that a college platform cannot discharge ' +
      'responsibly. The rating and trust systems exist, and a payment path could be ' +
      'added to them without a schema change to the session record.' },
    { text: 'No video conferencing. Sessions are scheduled and recorded as completed by ' +
      'both parties, but the meeting itself happens elsewhere.' },
    { text: 'No push notifications. Notifications are stored and shown in the application ' +
      'and delivered over the real-time channel, but there is no service worker.' }
  ]);

  h3('Environmental limitations');
  body('The system is deployed on free-tier hosting with a database hosted in a different ' +
    'region. Three consequences follow, and they are the reasons for specific ' +
    'engineering decisions elsewhere in this report.');

  table( ['Constraint', 'Consequence', 'How it is handled'], [
    ['Free tier sleeps the web service after inactivity',
      'The first request after a quiet period is slow, and may time out',
      'Kept in one runtime so a cold start costs one service, not two. Caching headers ' +
      'are set on the static bundle.'],
    ['Database is in a different region from the API',
      'Round-trip latency is high and connections occasionally time out',
      'A transaction-scoped connection pool with a keepalive, and all reads are indexed ' +
      'on the columns actually filtered.'],
    ['No job runner that can be relied upon to be always on',
      'Escrow auto-release would never fire',
      'The release job is a plain script scheduled by the platform cron service, and is ' +
      'safe to run by hand. Section 6.12.'],
    ['Email depends on a third-party provider being configured correctly',
      'A missing key silently loses password resets',
      'The mail helpers throw rather than returning false, so the failure is visible ' +
      'instead of being swallowed. Section 6.2.']
  ], [24, 32, 44], { caption: 'Table 1.3  Deployment constraints and how each is absorbed' });

  // =====================================================================
  h1('2', 'Literature Survey');
  mark('h1:2');

  h2('2.1', 'Existing Campus Platforms');
  body('The starting point for the survey was the systems a student of this college would ' +
    'already be using. Four categories are relevant, and each was examined for the ' +
    'property this project needs: whether it records a durable relationship between ' +
    'specific people, or only publishes content to whoever happens to look.')

  table( ['Category', 'Examples', 'What it does well', 'What it cannot do'], [
    ['Learning management systems', 'Moodle, Google Classroom, Canvas',
      'Course material, assignments, grades within one institution',
      'Nothing outside the institution. No alumni, no employers, no payments.'],
    ['Campus community platforms', 'CampusAmbition, FreshersLive, college ERP portals',
      'Notices, club pages, student directories',
      'A directory is not a relationship. Nothing records an interaction or its outcome.'],
    ['Internal talent marketplaces', 'Handshake, Symplicity,hire:express',
      'Employer relationships and applicant tracking for a whole institution',
      'Employer-side systems. They serve the placement cell, not the student, and require ' +
      'an institutional contract the college does not have.'],
    ['Freelance and gig marketplaces', 'Fiverr, Upwork, Internshala',
      'Escrow, ratings, dispute handling, work delivery',
      'Anonymity by design. Nothing binds a participant to a college, so the trust they ' +
      'build is not visible to the institution that cares about it.']
  ], [19, 21, 30, 30], { caption: 'Table 2.1  Comparison of existing platform categories' });

    body('The decision was to adopt the accepted-answer model. Its important property is ' +
    'not that an answer exists but that someone has judged it correct, and that judgement ' +
    'is attributable. Once attribution is attached to the act of accepting, the act ' +
    'becomes something the platform can reward, which is what makes the trust system in ' +
    'section 4.5 possible without asking anyone for a self-assessment.')

  h2('2.3', 'Escrow and Trust-Based Payment');
  body('Escrow is the mechanism on which the paid half of the platform depends, so it was ' +
    'studied in some detail. The essential property of an escrow system is not that money ' +
    'is held but that no single participant can move it alone.')

  h3('Models considered');
  bullets([
    { text: 'Direct transfer. The payer sends money directly. No protection for either ' +
      'side, and it cannot be used for a first transaction between strangers.' },
    { text: 'Milestone escrow. The amount is divided into milestones released separately. ' +
      'Better protection, but the state machine is proportionally larger and the ' +
      'platform has to decide what a milestone is, which it cannot know.' },
    { text: 'Full escrow with a deliverable gate. The whole amount is held and released ' +
      'once, against a submitted deliverable, with an automatic release deadline. One ' +
      'state machine, and the condition is something the platform can actually observe.' }
  ]);

  body('Full escrow with a deliverable gate was selected. Milestone escrow was rejected ' +
    'because the platform is not in a position to judge whether a milestone is complete, ' +
    'and a gate it cannot evaluate reliably is worse than no gate at all, because it ' +
    'creates a dispute surface without a resolution mechanism.')

  h3('State machines from the literature');
  body('The escrow record in this system moves through four states: locked, released, ' +
    'refunded, and disputed. Only three transitions are permitted, and each is guarded by ' +
    'a precondition that the code checks inside the transaction rather than after it. The ' +
    'rule that every transition must be expressed as a comparison against the current ' +
    'state is the single most useful idea taken from this part of the survey, and it is ' +
    'the reason a double release is a no-op rather than a second payment.')

  table( ['From', 'To', 'Guard condition', 'Who may perform it'], [
    ['locked', 'released', 'A deliverable has been submitted', 'Paying company, or an administrator'],
    ['locked', 'refunded', 'Within the dispute window', 'Paying company, or an administrator'],
    ['locked', 'disputed', 'Either party raises a dispute', 'Either party'],
    ['released', 'none', 'Terminal state', 'Not permitted'],
    ['refunded', 'none', 'Terminal state', 'Not permitted']
  ], [14, 16, 38, 32], { caption: 'Table 2.3  Escrow state transitions and their guards' });

  h2('2.4', 'Authentication and Token Management');
  body('Authentication was studied as a security question rather than a convenience one, ' +
    'because every screen in the system is behind it. Three approaches were compared: ' +
    'server sessions, JSON Web Tokens, and opaque tokens held server-side.')

  table( ['Approach', 'Revocation', 'Scaling', 'Complexity', 'Verdict'], [
    ['Server session', 'Immediate', 'Needs shared session store', 'Low',
      'Rejected; adds a store the free tier will not host'],
    ['Stateless JWT', 'None until expiry', 'Trivial', 'Low', 'Accepted for access tokens'],
    ['Opaque token with server-side lookup', 'Immediate', 'One query per request', 'Moderate',
      'Accepted for refresh tokens'],
    ['Hybrid, as implemented here', 'Refresh tokens revocable, access tokens not',
      'One lookup per refresh only', 'Moderate', 'Adopted']
  ], [26, 24, 22, 14, 14], { caption: 'Table 2.4  Token approaches compared' });

  body('The hybrid is standard practice: a short-lived access token is presented on every ' +
    'request and verified without a database lookup, and a longer-lived refresh token is ' +
    'stored as a hash and can therefore be revoked. Rotating the refresh token on each use ' +
    'means a stolen token is usable at most once before it is detected.')

  note('A defect the survey did not predict',
    'A JSON Web Token is only unique if something inside it varies. An access token ' +
    'carrying just the user identifier and an issued-at time with one-second resolution is ' +
    'byte-identical when two are minted for the same user in the same second. Because ' +
    'refresh tokens are stored as a hash, two such tokens collapse onto one stored row, ' +
    'and rotating one silently leaves the other valid. This was found by reading the ' +
    'implementation rather than by the survey, and is fixed by giving every token a unique ' +
    'identifier. It is recorded as defect D-03 in Appendix K.');

  h2('2.5', 'Real-Time Communication');
  body('Messaging had to be immediate, but not at the cost of a second deployed service. ' +
    'The options were a managed pub/sub service, long polling against the API, or a ' +
    'WebSocket endpoint on the existing server.')

  bullets([
    { text: 'Managed pub/sub. Correct at any scale, but it is another service to operate ' +
      'and to be billed for, and the platform has exactly one always-available runtime.' },
    { text: 'Long polling. Holds a request open, which ties up a connection per waiting ' +
      'client and does not survive a service sleep cleanly.' },
    { text: 'WebSocket on the existing server. One extra endpoint on the process that is ' +
      'already running, authenticated with the same token, and it shares the deployment.' }
  ]);

  body('The third was chosen. The cost is that a sleeping service also sleeps its sockets, ' +
    'which is why the client reconnects with backoff and re-fetches on reconnect rather ' +
    'than assuming that a missed frame was never sent. That trade is recorded in section ' +
    '6.7.')

  h2('2.6', 'Role-Based Access Control');
  body('Four roles were defined: student, company, mentor and administrator. The survey ' +
    'question was whether authorisation should be per-user permissions or per-role rules.')

  body('Per-user permissions are the more flexible model and were rejected. They require a ' +
    'permission table, an editing interface for it, and a decision about who may grant what. ' +
    'None of that is needed here, because the four participant types have genuinely ' +
    'different capabilities rather than differing subsets of the same one. A student cannot ' +
    'fund an escrow because a student is not a payer; that is a property of the role, not ' +
    'a grant that might later be delegated.')

  body('The implementation is therefore a middleware that names the roles permitted to call ' +
    'a route, declared next to the route rather than inside the controller. Keeping the ' +
    'declaration beside the route is what makes it reviewable: the full authorisation ' +
    'policy of the system can be read in one pass over the route files, which is exactly ' +
    'the check the sweep in section 7.3 performs automatically.')

  h2('2.7', 'Gap Identified');
  body('Four gaps survived the survey, and they are the reason the project exists. They are ' +
    'stated here in the form the design answers them.')

  table( ['Gap', 'Consequence for the user', 'Answer in this system'], [
    ['No system binds an external participant to a specific institution',
      'Trust earned on one platform is invisible to the college and unusable elsewhere',
      'Institutions are first-class records; every gig, session and escrow references one'],
    ['Escrow is available only at marketplace scale',
      'A college platform cannot offer the protection that makes strangers transact',
      'Escrow implemented directly, with an automatic release deadline'],
    ['Rating systems ask for self-assessment',
      'Trust scores are inflated and can be bought',
      'Trust derived only from observed, dated activity'],
    ['Messaging history and work history are separate',
      'Nothing connects a conversation to the outcome it produced',
      'Threads are linkable to the gig or session they concern']
  ], [30, 33, 37], { caption: 'Table 2.5  Gaps identified by the survey' });

  h2('2.8', 'Design Decisions Informed by the Survey');
  body('A survey that does not change a design is decoration. The following decisions were ' +
    'made because of something found in the review, and each is traceable from the reason ' +
    'to the place in the system that implements it.')

  table( ['Decision', 'Reason from the survey', 'Implemented in'], [
    ['Escrow over direct transfer',
      'Direct transfer cannot support a first transaction between strangers',
      'Section 4.4, implemented in section 6.6'],
    ['Deliverable gate on release, administrator-only bypass',
      'A gate that the paying party can switch off is not a protection',
      'Section 4.4, implemented in section 6.6'],
    ['Automatic release after seven days',
      'A deadlock in escrow is a worse outcome than either party being slightly unhappy',
      'Section 4.4, implemented in section 6.12'],
    ['Accepted-answer model for doubts',
      'Attributable judgement, not mere presence, is what makes trust computable',
      'Section 4.5, implemented in section 6.3'],
    ['Role-based authorisation declared at the route',
      'The policy must be reviewable in one pass, and it is tested automatically',
      'Section 4.5, implemented in section 6.10'],
    ['Refresh tokens stored as hashes and rotated',
      'Revocation requires the server to be able to recognise a used token',
      'Section 4.5, implemented in section 6.2'],
    ['Trust computed from history, never submitted',
      'Self-assessment cannot be the basis of a payment guarantee',
      'Section 4.5, implemented in section 6.5'],
    ['WebSocket on the existing runtime',
      'A second always-on service is not available in the target environment',
      'Section 3.5, implemented in section 6.7']
  ], [26, 38, 36], { caption: 'Table 2.6  Design decisions traceable to the survey' });

  body('One decision is worth singling out because it contradicts an instinct. The review ' +
    'found that every serious marketplace protects the payer, because the payer is the one ' +
    'who loses money if the protection fails. In this system the scarce and easily ' +
    'defrauded party is the student, because the student delivers the work and cannot ' +
    'verify whether a company has funded escrow at all. The deliverable gate was therefore ' +
    'placed on the payment path facing the company, and the restriction of the bypass flag ' +
    'to administrators was treated as a security requirement rather than a convenience.');
};