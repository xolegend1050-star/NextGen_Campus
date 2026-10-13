/**
 * Chapters 9 and 10.
 *
 * The conclusion states what the project set out to do, what it delivered, what it
 * could not do, and what would be attempted next. The reference list is a separate
 * chapter because it is a list rather than an argument, and giving it its own chapter
 * keeps the conclusion from ending on a wall of citations.
 */
module.exports = (ctx) => {
  const { h1, h2, body, bullets, table, code, note } = ctx.render;
  const { mark } = ctx;

  // =====================================================================
  h1('9', 'Conclusion and Future Scope');
  mark('h1:9');

  h2('9.1', 'Conclusion');
  body('The project set out to address a specific and unglamorous problem: students of ' +
    'this college had no structured route to the alumni working in industry, and the ' +
    'relationships that did exist were unrecorded and therefore unusable. The system that ' +
    'has been built makes those relationships explicit and durable. A mentorship session ' +
    'is requested, held, completed by both parties and rated, and the result is a record ' +
    'that both people keep and that the college can see.');

    h2('9.3', 'Limitations Encountered');
  body('Four limitations are worth stating honestly rather than leaving to be discovered.')

  bullets([
    { text: 'Mentorship carries no money. This is a deliberate decision rather than an ' +
      'oversight, and it is discussed in section 6.4. The consequence is that the most ' +
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

  h2('9.4', 'Future Enhancements');
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
  ], [26, 56, 18], { caption: 'Table 9.2  Candidate enhancements, in the order they would be attempted' });

  // =====================================================================
  h1('10', 'References');
  mark('h1:10');

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
      'Internet Engineering Task Force, 2015.', 'Sections 2.4, 4.5, 6.2'],
    ['R-05', 'Bradner, S. et al. The Twelve-Factor App, Heroku, 2011.',
      'Sections 1.5, 3.4'],
    ['R-06', 'Provos, N. and Mazières, D. A Future-Adaptable Password Scheme. USENIX ' +
      'Annual Technical Conference, 1999.', 'Section 4.5'],
    ['R-07', 'O\'Neil, B., Chen, E., Gawley, D. and O\'Neil, E. The Transactional Method. ' +
      'Morgan Kaufmann, 1993.', 'Section 4.3'],
    ['R-08', 'Kleppmann, M. Designing Data-Intensive Applications. O\'Reilly Media, 2017.',
      'Sections 2.3, 4.3'],
    ['R-09', 'OWASP Foundation. OWASP Top 10: The ten most critical web application security ' +
      'risks.', 'Sections 4.5, 6.10'],
    ['R-10', 'OpenJS Foundation. Express.js Documentation.', 'Sections 4.2, 6.1'],
    ['R-11', 'Meta Open Source. React Documentation.', 'Section 4.6'],
    ['R-12', 'PostgreSQL Global Development Group. PostgreSQL Documentation: Transaction ' +
      'Isolation, Row-Level Locks and Partial Indexes.', 'Sections 4.3, 6.6'],
    ['R-13', 'Ecma International. ECMAScript Language Specification, ECMA-262.',
      'Section 6.1'],
    ['R-14', 'Nielsen, J. Usability Engineering. Morgan Kaufmann, 1993.',
      'Section 4.6'],
    ['R-15', 'Institute of Electrical and Electronics Engineers. IEEE Standard for ' +
      'Information Technology, System Design.', 'Section 4.1']
  ], [7, 70, 23], { caption: 'Table 10.1  References' });
};
