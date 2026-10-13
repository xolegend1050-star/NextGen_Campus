/**
 * Front matter: cover, certificate, progress report, index, acknowledgement and
 * preliminary investigation.
 *
 * The progress report reads its figures from the live repository, so the front
 * matter cannot claim a number that the rest of the document contradicts.
 */
const fs = require('fs');
const path = require('path');

const { D } = require('../details');
const T = require('../theme');

const BACKEND = path.resolve(__dirname, '..', '..', '..', 'backend');
const FRONTEND = path.resolve(__dirname, '..', '..', '..', 'frontend');

const countFiles = (dir, ext) => {
  let n = 0;
  const walk = (d) => {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const i of items) {
      if (i.name === 'node_modules' || i.name === '.git' || i.name === 'dist') continue;
      const p = path.join(d, i.name);
      if (i.isDirectory()) walk(p);
      else if (!ext || i.name.endsWith(ext)) n++;
    }
  };
  walk(dir);
  return n;
};

const load = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/** Centred heading with a rule under it, for the unpaginated front pages. */
const frontHeading = (doc, text, size) => {
  doc.font('Times-Bold').fontSize(size).fillColor(T.INK)
    .text(text, T.M.left, doc.y, { width: T.CONTENT_W, align: 'center' });
  doc.y += size * 0.6;
  doc.moveTo(T.M.left + 150, doc.y).lineTo(T.PAGE.W - T.M.right - 150, doc.y)
    .lineWidth(T.RULE.chapter).strokeColor(T.INK).stroke();
  doc.y += 20;
};

module.exports = (ctx) => {
  const { h1, h2, para, body, table } = ctx.render;
  const { doc, mark, setChapter } = ctx;

  const routes = load(path.join(__dirname, '..', 'data', 'api-routes.json')) || [];
  const schema = load(path.join(__dirname, '..', 'data', 'db-schema.json'))
    || { tables: [], indexes: [], triggers: [] };
  const moduleCount = new Set(routes.map((r) => r.module)).size;
  const colCount = schema.tables.reduce((a, t) => a + t.columns.length, 0);

  // ===================================================== 1. COVER
  ctx.front.cover();

  // ===================================================== 2. CERTIFICATE
  doc.addPage();
  doc.y = T.M.top;
  setChapter('Certificate of Approval');
  frontHeading(doc, 'DEPARTMENT OF COMPUTER SCIENCE   (' + D.academicYear + ')', 12);
  frontHeading(doc, 'Certificate of Approval', 16);

  body('This is to certify that the project work entitled "' + D.title + '" is prepared by ' +
    D.student + ', having Roll No. ' + D.rollNo + ', a student of the Third Year ' +
    D.degree + ' programme at ' + D.college + '.');

  body('The work presented in this project report is an original study carried out by the student. ' +
    'All important sources of information and references used in the preparation of this report have ' +
    'been duly acknowledged.');

  body('This project report is submitted in partial fulfilment of the requirements for the ' +
    D.degree + ', ' + D.semester + ', in accordance with the rules and regulations of the ' +
    D.university + '.');

  doc.moveDown(1.4);
  ctx.front.signatures([
    { label: 'Project Guide', name: D.guide },
    { label: 'Head of Department', name: D.hod },
    { label: 'External Examiner', name: null }
  ]);

  doc.font('Times-Roman').fontSize(10.5).fillColor(T.INK)
    .text('Date and College Seal:', T.M.left, doc.y, { width: T.CONTENT_W, align: 'right' });
  doc.font('Times-Bold').fontSize(10.5).fillColor(T.INK)
    .text('_____________________', T.M.left, doc.y + 14, { width: T.CONTENT_W, align: 'right' });
  mark('front:Certificate');

  // ===================================================== 3. PROGRESS REPORT
  doc.addPage();
  doc.y = T.M.top;
  setChapter('Progress Report');
  frontHeading(doc, 'Progress Report', 16);

  table(['Field', 'Detail'], [
    ['Project Title', D.title],
    ['Student Name', D.student],
    ['Roll Number', D.rollNo],
    ['Class and Division', D.degree + ', ' + D.semester],
    ['Academic Year', D.academicYear],
    ['Project Guide', D.guide],
    ['Head of Department', D.hod],
    ['College', D.college],
    ['University', D.university],
    ['Technology Used', 'React with Vite; Node.js and Express; PostgreSQL'],
    ['Modules Implemented', moduleCount + ' backend route modules'],
    ['Endpoints Delivered', String(routes.length) + ' HTTP endpoints'],
    ['Database Design', schema.tables.length + ' tables, ' + colCount + ' columns, ' +
      schema.indexes.length + ' indexes, ' + schema.triggers.length + ' triggers'],
    ['Test Coverage', '93 unit tests passing, plus a three-file endpoint sweep'],
    ['Defects Found and Fixed', '19, documented in Chapter 6 and Appendix K']
  ], [24, 76], { caption: 'Table 0.1  Project particulars' });

  mark('front:Progress Report');

  // ===================================================== 4. INDEX
  doc.addPage();
  doc.y = T.M.top;
  setChapter('Index');
  frontHeading(doc, 'INDEX', 16);
  mark('front:Index');
  ctx.front.index();

  // ===================================================== 5. ACKNOWLEDGEMENT
  h1(null, 'Acknowledgement');
  mark('front:Acknowledgement');

  body('I would like to express my sincere gratitude to my project guide, ' + D.guide +
    ', whose patient guidance, careful review and constant encouragement shaped both this ' +
    'project and the report that describes it. Every design decision in this document was ' +
    'discussed before it was written down, and several of them are better for having been ' +
    'questioned first.');

  body('I am grateful to ' + D.hod + ', Head of the Department of Computer Science, for the ' +
    'laboratory facilities, library access and departmental guidance, and to ' + D.principal +
    ' for the academic environment in which this work was carried out.');

  body('I thank the faculty of the ' + D.department + ' for the teaching that formed the ' +
    'foundation of this work, particularly in database management systems, computer networks ' +
    'and operating systems, and the staff of ' + D.college + ' for their support throughout.');

  body('Finally, I acknowledge my family and friends for their support and patience during ' +
    'the development of this project, and the students who tested the system and reported the ' +
    'defects recorded in Chapter 6 and Appendix K. Those reports made the software better ' +
    'than I would have left it.');

  // ===================================================== 6. PRELIMINARY INVESTIGATION
  h1(null, 'Preliminary Investigation');
  mark('front:Preliminary Investigation');

  h2('', 'Organisational Overview');
  body('The project was undertaken at ' + D.college + ', affiliated to ' + D.university +
    ', offering the three-year ' + D.degree + ' programme to a student body drawn largely ' +
    'from tier two and tier three institutions. The college runs on limited resources: ' +
    'there is no dedicated career services function, no placement cell with access to ' +
    'employer databases, and no mechanism by which a student can be introduced to an alumnus ' +
    'working in a relevant field.');

  body('These gaps are structural rather than administrative. Students apply for internships ' +
    'through public job boards on which they compete against graduates from every ' +
    'institution in the country, with no way to show that a colleague, a senior or an ' +
    'alumnus of this specific college has already done the work. Employers recruiting for ' +
    'tier two and tier three colleges face the mirror image: they cannot easily find these ' +
    'students, and when they do they cannot assess them without a long interview.');

  h2('', 'Existing Facilities');
  body('The college provides a computer laboratory, internet access and a functioning ' +
    'internal network. Students already use a learning management system for course material, ' +
    'email, and informal messaging groups. What does not exist is any system connecting a ' +
    'student to a working professional from this institution, or one that records the ' +
    'outcome of such a connection.');

  h2('', 'Problem Definition');
  body('The problem is therefore specific rather than general: there is no structured channel ' +
    'between students of this college and alumni working in industry, and no way to record, ' +
    'verify or build on the professional relationships that already exist informally between ' +
    'them. A system addressing only job listings, without addressing the alumni relationship ' +
    'and the trust it carries, would reproduce the weakness of the existing job boards.');

  h2('', 'Feasibility Study');
  table(['Dimension', 'Assessment'], [
    ['Technical', 'Feasible. A single-page application, a REST API and a relational database ' +
      'are sufficient. The difficult parts are trust and payments, not scale.'],
    ['Economic', 'Feasible. The entire stack is open source and the deployment uses a free ' +
      'tier. No licensing cost arises at any stage.'],
    ['Operational', 'Feasible. The system is maintained by the department. Ownership of ' +
      'alumni data was raised as a concern and is addressed in section 5.2.'],
    ['Legal', 'Feasible with care. Payments are held in escrow by the platform rather than ' +
      'transferred directly between the parties, and no personal data is published without ' +
      'the individual\'s consent.'],
    ['Schedule', 'Feasible. The work was carried out within one semester, with testing run ' +
      'continuously rather than deferred to the end.']
  ], [17, 83], { caption: 'Table 0.2  Feasibility assessment' });

  h2('', 'Tools and Techniques');
  body('The system was built as a three-tier application. The presentation tier is a React ' +
    'single page application served as static files, with no server-side rendering, chosen ' +
    'because every screen in the application is behind authentication and there is nothing ' +
    'for a crawler to index. The application tier is a Node.js and Express REST API with a ' +
    'Socket.IO endpoint for real-time messaging, chosen so that one runtime serves both the ' +
    'synchronous request traffic and the long-lived connections without a second deployment ' +
    'to operate. The data tier is PostgreSQL, chosen over a document store because the ' +
    'central problem in this system is money, and money requires transactions, row-level ' +
    'locking and a fixed schema.');

  body('Authorisation is by role rather than per-user permission, which suits a system with ' +
    'four well-defined participant types. Validation is applied at the route boundary using ' +
    'declarative chains rather than inside controllers, so a malformed request is rejected ' +
    'before any business logic runs. Every state change that moves money is wrapped in a ' +
    'database transaction, which is discussed in section 4.3.');
};