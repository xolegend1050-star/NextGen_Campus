/**
 * Two-pass driver.
 *
 * A heading's page number is not known until everything before it has been laid
 * out, and the index is itself part of the document it measures, so one pass
 * cannot be enough. This lays the report out repeatedly until two consecutive
 * passes agree on every page number, which means the index printed in the final
 * pass is describing the page each heading is actually on.
 *
 * That fixpoint matters more than it sounds. The previous version rendered a
 * one line placeholder index in pass one and the real two page index in pass two,
 * so every heading after the index was listed one page before it printed. The
 * Acknowledgement was on page 6 in the index and page 7 in the document.
 */
const fs = require('fs');
const path = require('path');

const { D, CHAPTERS, APPENDICES, SECTION_TITLES } = require('./details');
const theme = require('./theme');
const render = require('./render');
const front = require('./front');

const { makeDoc, pageCount } = theme;

const OUT = path.join(__dirname, 'out', 'NextGen_Campus_Project_Report.pdf');
const TMP = path.join(__dirname, 'out', '.pass.tmp.pdf');
const SIDE = path.join(__dirname, 'out', 'layout.json');

fs.mkdirSync(path.dirname(OUT), { recursive: true });

/**
 * Refuse to build without the generated reference data.
 *
 * The API reference and the data dictionary are generated from the source, and a
 * missing file does not produce an error: it produces an appendix with nothing in
 * it, a document several pages shorter than intended, and a build that reports
 * success. That is a silent failure, so it is turned into a loud one here.
 */
const requireReferenceData = () => {
  const missing = [];
  const check = (name, min, what) => {
    const p = path.join(__dirname, 'data', name);
    let data = null;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { missing.push(name + ' is missing'); return; }
    const n = Array.isArray(data) ? data.length : (data.tables || []).length;
    if (n < min) missing.push(name + ' has ' + n + ' ' + what + ', expected at least ' + min);
  };
  check('api-routes.json', 100, 'endpoints');
  check('db-schema.json', 40, 'tables');
  if (missing.length) {
    console.error('  CANNOT BUILD: ' + missing.join('; '));
    console.error('  run: npm run extract');
    process.exit(1);
  }
};
requireReferenceData();

// Order is the reading order, and it is also what decides the page numbers: each
// entry is a module that renders one or more chapters in sequence.
const SECTIONS = [
  './content/00-front.js',
  './content/01-ch12.js',            // 1 Introduction, 2 Literature Survey
  './content/02-ch34.js',            // 3 System Analysis, 4 System Design
  './content/03-ch5technology.js',   // 5 Technology and Methodology
  './content/04-impl6.js',           // 6 Implementation
  './content/05-ch7testing.js',      // 7 Testing
  './content/06-ch8results.js',      // 8 Results
  './content/07-ch9concl10refs.js',  // 9 Conclusion, 10 References
  './content/08-appendixA-D.js',
  './content/09-appendixE-L.js',
  './content/10-appendixM-N.js'
].map((p) => require(p));

/**
 * Finalises the document and resolves only once the bytes have reached the disk.
 *
 * PDFDocument emits "end" when it has finished writing the document structure,
 * which is still buffered in the file stream underneath it. Resolving on that
 * event alone returns a truncated file.
 */
const done = (doc) => new Promise((res, rej) => {
  const stream = doc.fileStream;
  if (!stream) { rej(new Error('document has no file stream')); return; }
  stream.on('finish', res);
  stream.on('error', rej);
  doc.end();
});

// Each appendix is its own top level contents entry rather than nested under a
// single "Appendices" heading, so the index has one addressable label per
// appendix and the verifier can match it against a real heading in the text.
const INDEX_ENTRIES = [
  { key: 'front:Certificate', label: 'Certificate of Approval' },
  { key: 'front:Progress Report', label: 'Progress Report' },
  { key: 'front:Index', label: 'Index' },
  { key: 'front:Acknowledgement', label: 'Acknowledgement' },
  { key: 'front:Preliminary Investigation', label: 'Preliminary Investigation' },
  ...CHAPTERS.map((c) => ({ key: 'h1:' + c.num, label: 'Chapter ' + c.num + ': ' + c.title })),
  ...APPENDICES.map((a) => ({
    key: 'h1:' + a.key, label: 'Appendix ' + a.key + ': ' + a.title
  }))
];

const buildRows = (captured) => INDEX_ENTRIES.map((e) => {
  const page = captured[e.key];
  if (!page) { console.warn('  ! no page recorded for ' + e.key + ' (' + e.label + ')'); return null; }
  const row = { ...e, page };
  const ch = CHAPTERS.find((c) => 'h1:' + c.num === e.key);
  if (ch) {
    row.subs = {};
    ch.sections.forEach((n) => {
      const p = captured['h2:' + n];
      if (p) row.subs[n] = { page: p, label: SECTION_TITLES[n] || n };
    });
    // A chapter with no numbered sections still needs its entry to compare.
    if (!Object.keys(row.subs).length) row.subs = null;
  }
  return row;
}).filter(Boolean);

const sameRows = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label || a[i].page !== b[i].page) return false;
    const as = a[i].subs || {}, bs = b[i].subs || {};
    const ak = Object.keys(as), bk = Object.keys(bs);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!bs[k] || bs[k].page !== as[k].page) return false;
  }
  return true;
};

/** Runs every content section against one document. */
const layout = (doc, indexRows) => {
  const captured = {};
  const stats = { tables: 0, codeBlocks: 0, notes: 0, indexRows: 0 };
  let chapter = 'Project Report';

  const ctx = {
    doc,
    setChapter: (c) => { chapter = c; D.chapter = c; },
    // Page numbers are read after the element is drawn. PDFKit starts a new page
    // while writing text that will not fit, so a number read beforehand
    // describes the page the heading was about to leave, not the one it printed on.
    mark: (key) => { captured[key] = pageCount(doc); },
    getStat: () => stats,
    setStat: (k, v) => { stats[k] = v; }
  };

  // Every renderer takes the context as its first argument. Binding it here once
  // means the content modules can call body('text') rather than body(ctx, 'text'),
  // and removes the chance of the two drifting out of step.
  const bound = {};
  for (const [name, fn] of Object.entries(render)) {
    if (typeof fn === 'function') bound[name] = (...args) => fn(ctx, ...args);
  }
  ctx.render = bound;

  ctx.front = {
    cover: () => front.cover(ctx, D),
    signatures: (entries) => front.signatureBlock(ctx, entries),
    index: () => front.renderIndex(ctx, indexRows),
    letterhead: () => front.drawLetterhead(doc, theme.CONTENT_W)
  };

  SECTIONS.forEach((fn) => fn(ctx));
  return { captured, stats, indexPages: ctx.indexPages || null };
};

(async () => {
  const MAX_PASSES = 8;
  let rows = null;
  let pass = 0;
  let stats = null;
  let captured = null;

  for (pass = 1; pass <= MAX_PASSES; pass++) {
    const doc = makeDoc(TMP, { title: D.title + ' - Project Report', author: D.student, subject: D.degree + ' ' + D.semester });
    const r = layout(doc, rows);
    await done(doc);

    const next = buildRows(r.captured);
    stats = r.stats;
    captured = r.captured;
    if (rows && sameRows(rows, next)) {
      console.log('  index settled after ' + (pass - 1) + ' pass(es)');
      break;
    }
    if (pass > 1) console.log('  pass ' + pass + ': page numbers moved, repeating');
    rows = next;
  }
  if (pass > MAX_PASSES) console.warn('  ! index did not settle in ' + MAX_PASSES + ' passes');

  const doc = makeDoc(OUT, { title: D.title + ' - Project Report', author: D.student, subject: D.degree + ' ' + D.semester });
  const finalRun = layout(doc, rows);
  const total = pageCount(doc);
  front.decorate(doc, D, total);
  await done(doc);

  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);

  // The verifier reads this to check the printed index against the document,
  // rather than trusting the build's own bookkeeping.
  fs.writeFileSync(SIDE, JSON.stringify({
    total,
    indexRows: rows,
    indexPages: finalRun.indexPages,
    captured: finalRun.captured,
    stats: finalRun.stats,
    identity: {
      title: D.title, student: D.student, rollNo: D.rollNo,
      guide: D.guide, college: D.college, semester: D.semester
    }
  }, null, 1));

  console.log('  written    : ' + OUT);
  console.log('  contents   : ' + rows.length + ' entries, ' +
    rows.reduce((a, r) => a + (r.subs ? Object.keys(r.subs).length : 0), 0) + ' sections');
  console.log('  passes     : ' + pass);
  console.log('  total pages: ' + total);
  console.log('  rendered   : ' + stats.tables + ' tables, ' + stats.codeBlocks +
    ' code blocks, ' + stats.notes + ' notes');
  process.exit(0);
})().catch((e) => {
  console.error('  BUILD FAILED: ' + e.stack);
  process.exit(1);
});