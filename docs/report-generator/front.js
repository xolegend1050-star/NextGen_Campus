/**
 * Front matter, index, and the running head and footer.
 *
 * The footer is a three part table rather than a centred page number, which is
 * the convention for a submitted report: what the report is called on the left,
 * "Page n of m" on the right, and the chapter in the middle. A bare centred
 * number was all the previous version had, and it gave the reader no way to
 * orient themselves.
 */
const fs = require('fs');
const path = require('path');
const {
  PDFDocument, PAGE, M, CONTENT_W, TEXT_BOTTOM,
  INK, PAPER, TYPE, RULE, MIN_PT, makeDoc, pageCount
} = require('./theme');

const rule = (doc, x1, y1, x2, y2, w) =>
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(w).strokeColor(INK).stroke();

// ---------------------------------------------------------------- letterhead
// The college's own scan, used verbatim. It is the one thing in the document
// that is not pure black, because an institutional crest should never be
// redrawn or recoloured. On a black and white printer it prints as grey, which
// is what an official letterhead does.
const LETTERHEAD = path.join(__dirname, 'assets', 'letterhead.png');

let letterheadSize = null;
try {
  const b = fs.readFileSync(LETTERHEAD);
  if (b.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    letterheadSize = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
} catch { /* absent is handled at draw time */ }

const drawLetterhead = (doc, width) => {
  if (!letterheadSize) return 0;
  const h = (width * letterheadSize.h) / letterheadSize.w;
  doc.image(LETTERHEAD, M.left, doc.y, { width, height: h });
  doc.y += h;
  return h;
};

// ---------------------------------------------------------------- cover
const cover = (ctx, D) => {
  const { doc } = ctx;
  // The document is created with autoFirstPage, so page 1 already exists.
  // Calling addPage here used to leave an empty sheet in front of the cover.
  doc.y = M.top;

  drawLetterhead(doc, CONTENT_W);
  doc.y += 26;

  const centred = (text, font, size, gap) => {
    doc.font(font).fontSize(size).fillColor(INK)
      .text(text, M.left, doc.y, { width: CONTENT_W, align: 'center' });
    doc.y += gap;
  };

  centred('Department of Computer Science', 'Times-Bold', 14, 6);
  centred('(Academic Year ' + D.academicYear + ')', 'Times-Roman', 12, 30);

  rule(doc, M.left + 150, doc.y, PAGE.W - M.right - 150, doc.y, RULE.chapter);
  doc.y += 22;

  centred('PROJECT REPORT', 'Times-Bold', 24, 34);
  centred(D.title, 'Times-Bold', 22, 8);
  centred(D.subtitle, 'Times-Italic', 13, 32);

  centred('A project report submitted in partial fulfilment of the requirements', 'Times-Roman', 12, 2);
  centred('for the degree of', 'Times-Roman', 12, 8);
  centred(D.degree + ', ' + D.semester, 'Times-Bold', 13, 4);
  centred(D.university, 'Times-Roman', 12, 30);

  centred('Submitted by:', 'Times-Roman', 12, 2);
  centred(D.student, 'Times-Bold', 14, 2);
  centred('Roll No: ' + D.rollNo, 'Times-Roman', 12, 22);

  centred('Under the guidance of', 'Times-Roman', 12, 2);
  centred(D.guide, 'Times-Bold', 14, 26);

  centred(D.college + ', ' + D.collegeAddr, 'Times-Italic', 11, 20);
  centred('Date : _____________________', 'Times-Roman', 12, 0);

  ctx.mark('front:Cover', doc);
};

// ---------------------------------------------------------------- signature row
const signatureBlock = (ctx, entries) => {
  const { doc } = ctx;
  const y = doc.y;
  const col = CONTENT_W / entries.length;
  const w = col - 34;

  entries.forEach((e, i) => {
    const x = M.left + i * col;
    rule(doc, x, y, x + w, y, RULE.tableHead);
    doc.font('Times-Roman').fontSize(10.5).fillColor(INK)
      .text(e.label, x, y + 5, { width: w, align: 'center' });
    if (e.name) {
      doc.font('Times-Italic').fontSize(9.5).fillColor(INK)
        .text(e.name, x, y + 20, { width: w, align: 'center' });
    }
  });
  doc.y = y + 46;
};

// ---------------------------------------------------------------- index
/**
 * The index is laid out as a bordered table rather than as loose lines.
 *
 * Dotted leaders are the usual choice on screen, and they are exactly what a
 * photocopier turns into a smear. A three column grid, with the page number
 * right aligned inside its own ruled cell, survives printing and is easier to
 * scan down a column.
 */
const renderIndex = (ctx, rows) => {
  const { doc } = ctx;
  const LABEL_W = CONTENT_W * 0.74;
  const PAGE_W = CONTENT_W - LABEL_W;
  const ROW_H = 15.5;

  // The pages this index occupies are recorded so the verifier can exclude them
  // when it looks for the headings the index points at. Excluding the wrong set
  // of pages here is how every contents check ends up reporting "not found".
  const firstPage = pageCount(doc);
  ctx.indexPages = [firstPage, firstPage];

  if (!rows || !rows.length) {
    doc.font('Times-Italic').fontSize(11).fillColor(INK)
      .text('generating', M.left, doc.y, { width: CONTENT_W, align: 'center' });
    return;
  }

  const flat = [];
  rows.forEach((e) => {
    flat.push({ label: e.label, page: e.page, level: 1 });
    const subs = e.subs || {};
    Object.keys(subs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach((num) => {
        flat.push({ label: num + '   ' + subs[num].label, page: subs[num].page, level: 2 });
      });
  });

  let y = doc.y;
  let drawn = 0;

  const drawRow = (row) => {
    if (y + ROW_H > TEXT_BOTTOM) {
      doc.addPage();
      doc.y = M.top;
      y = doc.y;
    }
    doc.fillColor(PAPER).rect(M.left, y, CONTENT_W, ROW_H).fill();

    doc.font(row.level === 1 ? 'Times-Bold' : 'Times-Roman')
      .fontSize(row.level === 1 ? TYPE.index : TYPE.indexSub)
      .fillColor(INK)
      .text(row.label, M.left + (row.level === 1 ? 4 : 18), y + 3, {
        width: LABEL_W - 12, lineBreak: false
      });

    doc.font('Times-Bold').fontSize(row.level === 1 ? TYPE.index : TYPE.indexSub)
      .fillColor(INK)
      .text(String(row.page), M.left + LABEL_W, y + 3, { width: PAGE_W - 8, align: 'right', lineBreak: false });

    rule(doc, M.left, y + ROW_H, M.left + CONTENT_W, y + ROW_H, RULE.hair);
    rule(doc, M.left + LABEL_W, y, M.left + LABEL_W, y + ROW_H, RULE.hair);
    y += ROW_H;
    drawn++;
  };

  flat.forEach(drawRow);
  doc.x = M.left;
  doc.y = y + 8;
  ctx.indexPages = [firstPage, pageCount(doc)];
  ctx.setStat('indexRows', drawn);
};

// ---------------------------------------------------------------- running head and foot
/**
 * Applied last, once every page exists.
 *
 * Both bands are drawn with the page margins temporarily opened, because
 * PDFKit starts a fresh page when text is written outside the margin area even at
 * an explicit y. Leaving the margins in place is what gave the previous version
 * a phantom extra page for every page number.
 */
const decorate = (doc, D, total) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue;                       // no furniture on the cover

    const savedTop = doc.page.margins.top;
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;

    doc.fillColor(INK).font('Times-Roman').fontSize(TYPE.running)
      .text(D.title, M.left, 30, { width: CONTENT_W * 0.5, lineBreak: false });
    doc.fillColor(INK).font('Times-Italic').fontSize(TYPE.running)
      .text(D.chapter || 'Project Report', M.left + CONTENT_W * 0.5, 30, {
        width: CONTENT_W * 0.5, align: 'right', lineBreak: false
      });
    rule(doc, M.left, 44, PAGE.W - M.right, 44, RULE.thin);

    rule(doc, M.left, PAGE.H - 40, PAGE.W - M.right, PAGE.H - 40, RULE.thin);
    doc.fillColor(INK).font('Times-Roman').fontSize(TYPE.running)
      .text(D.college, M.left, PAGE.H - 33, { width: CONTENT_W * 0.55, lineBreak: false });
    doc.fillColor(INK).font('Times-Bold').fontSize(TYPE.running)
      .text('Page ' + (i + 1) + ' of ' + total, M.left + CONTENT_W * 0.55, PAGE.H - 33, {
        width: CONTENT_W * 0.45, align: 'right', lineBreak: false
      });

    doc.page.margins.top = savedTop;
    doc.page.margins.bottom = savedBottom;
  }
};

module.exports = { cover, signatureBlock, renderIndex, decorate, drawLetterhead, LETTERHEAD, letterheadSize };