/**
 * The document renderer: headings, prose, bullets, tables, code, callouts.
 *
 * Every flow element measures its own height first and decides whether it fits
 * before drawing anything. That is the whole design. PDFKit paginates lazily
 * while text is written, so anything that does not measure first can either be
 * silently split or start a page mid element, and both failures look like blank
 * or half empty pages rather than like errors.
 */
const {
  PAGE, M, CONTENT_W, TEXT_BOTTOM,
  INK, PAPER, TYPE, MIN_PT, RULE, ensure
} = require('./theme');

// ---------------------------------------------------------------- helpers
const line = (doc, x1, y1, x2, y2, width) => {
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(width).strokeColor(INK).stroke();
};

const box = (doc, x, y, w, h, width) => {
  doc.rect(x, y, w, h).lineWidth(width).strokeColor(INK).stroke();
};

const fillBox = (doc, x, y, w, h) => {
  doc.rect(x, y, w, h).fillColor(PAPER).fill();
};

/** How tall would this text be, without drawing it. */
const measure = (doc, text, opts) =>
  doc.font(opts.font || 'Times-Roman').fontSize(opts.size)
    .heightOfString(String(text), { width: opts.width, lineGap: opts.lineGap || 0, align: opts.align || 'left' });

/**
 * Prevent a heading from being stranded at the foot of a page. A heading
 * followed immediately by a page break is the classic layout defect in a
 * submitted document, and it is invisible until someone prints it.
 */
const keepWithNext = (doc, headingHeight, followingHeight) => {
  if (doc.y + headingHeight + followingHeight > TEXT_BOTTOM) {
    doc.addPage();
    doc.y = M.top;
    return true;
  }
  return false;
};

// ---------------------------------------------------------------- headings
const h1 = (ctx, num, text) => {
  const { doc, mark, setChapter } = ctx;
  doc.addPage();
  doc.y = M.top;
  const label = num ? 'Chapter ' + num + ': ' + text : text;
  setChapter(label);
  mark('h1:' + (num || text), doc);

  doc.font('Times-Bold').fontSize(TYPE.h1).fillColor(INK)
    .text(label.toUpperCase(), M.left, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.4);

  // A rule rather than a coloured bar. Thick, centred, unmistakable.
  const y = doc.y;
  line(doc, M.left + 90, y, PAGE.W - M.right - 90, y, RULE.chapter);
  doc.y = y + 12;
};

const h2 = (ctx, num, text) => {
  const { doc, mark } = ctx;
  const label = num ? num + '   ' + text : text;
  const h = measure(doc, label, { font: 'Times-Bold', size: TYPE.h2, width: CONTENT_W });

  keepWithNext(doc, h, 40);
  // Only numbered headings are addressable by the contents list. An unnumbered
  // one is front matter, and marking it would file it under the key "h2:".
  if (num) mark('h2:' + num, doc);

  doc.font('Times-Bold').fontSize(TYPE.h2).fillColor(INK)
    .text(label, M.left, doc.y, { width: CONTENT_W });
  const y = doc.y + 3;
  line(doc, M.left, y, PAGE.W - M.right, y, RULE.thin);
  doc.y = y + 10;
};

const h3 = (ctx, text) => {
  const { doc } = ctx;
  const h = measure(doc, text, { font: 'Times-BoldItalic', size: TYPE.h3, width: CONTENT_W });
  keepWithNext(doc, h, 34);
  doc.font('Times-BoldItalic').fontSize(TYPE.h3).fillColor(INK)
    .text(text, M.left, doc.y, { width: CONTENT_W });
  doc.moveDown(0.25);
  doc.y += 3;
};

// ---------------------------------------------------------------- prose
const para = (ctx, text, o = {}) => {
  const { doc } = ctx;
  const size = o.size || TYPE.body;
  const lineGap = o.lineGap === undefined ? 3.5 : o.lineGap;  // ~1.25 leading
  const indent = o.indent || 0;
  const width = CONTENT_W - indent;
  const height = measure(doc, text, { font: o.bold ? 'Times-Bold' : 'Times-Roman', size, width, lineGap, align: 'justify' });
  ensure(doc, Math.min(height, TEXT_BOTTOM - doc.y) + 12);

  doc.font(o.bold ? 'Times-Bold' : 'Times-Roman').fontSize(size).fillColor(INK)
    .text(text, M.left + indent, doc.y, {
      width, align: o.align || 'justify', lineGap, indent: 0
    });
  doc.y += o.after === undefined ? 8 : o.after;
};

// justified body with a hanging first line indent, for narrative prose
const body = (ctx, text) => para(ctx, text, { indent: 0, after: 8 });

const bullets = (ctx, items) => {
  const { doc } = ctx;
  const size = TYPE.body;
  const lineGap = 3.5;
  const indent = 20;
  const width = CONTENT_W - indent;

  for (const raw of items) {
    const text = typeof raw === 'string' ? raw : raw.text;
    const bold = typeof raw === 'object' && raw.bold;
    const height = measure(doc, '\u2022   ' + text, {
      font: bold ? 'Times-Bold' : 'Times-Roman', size, width, lineGap
    });
    ensure(doc, Math.min(height, TEXT_BOTTOM - doc.y) + 6);

    const top = doc.y;
    doc.font('Times-Roman').fontSize(size).fillColor(INK)
      .text('\u2022', M.left + 4, top, { width: 12, lineBreak: false });
    doc.font(bold ? 'Times-Bold' : 'Times-Roman').fontSize(size).fillColor(INK)
      .text(text, M.left + indent, top, { width, align: 'justify', lineGap });
    doc.y = Math.max(doc.y, top + height) + 4;
  }
  doc.y += 4;
};

/** A numbered list, used for the step by step procedures. */
const numbered = (ctx, items) => {
  const { doc } = ctx;
  const size = TYPE.body;
  const lineGap = 3.5;
  const indent = 26;
  const width = CONTENT_W - indent;

  items.forEach((text, i) => {
    const n = String(i + 1) + '.';
    const height = measure(doc, n + '   ' + text, {
      font: 'Times-Roman', size, width, lineGap
    });
    ensure(doc, Math.min(height, TEXT_BOTTOM - doc.y) + 6);
    const top = doc.y;
    doc.font('Times-Bold').fontSize(size).fillColor(INK)
      .text(n, M.left + 2, top, { width: 20, lineBreak: false });
    doc.font('Times-Roman').fontSize(size).fillColor(INK)
      .text(text, M.left + indent, top, { width, align: 'justify', lineGap });
    doc.y = Math.max(doc.y, top + height) + 6;
  });
  doc.y += 6;
};

// ---------------------------------------------------------------- tables
/**
 * A fully bordered table.
 *
 * The previous version shaded alternate rows to make them trackable and relied on
 * that for legibility. Shading is the first thing a photocopier destroys, so the
 * row separators here are drawn instead, on every row, which is what actually
 * makes a long table readable on paper.
 *
 * A table taller than the space left starts on a fresh page rather than
 * splitting. If it is taller than a whole page it is split at a row boundary
 * with the header repeated, because letting PDFKit break mid table produces one
 * page per overflowing row.
 */
const table = (ctx, head, rows, widths, o = {}) => {
  const { doc } = ctx;
  if (!rows || !rows.length) return;
  if (ctx.setStat) ctx.setStat('tables', ctx.getStat().tables + 1);

  const total = widths.reduce((a, b) => a + b, 0);
  // Proportional widths, with a floor so a narrow column cannot become zero.
  //
  // The floor can push the sum past the text block: a 4% first column becomes 18pt,
  // is raised to the 30pt floor, and the table is now 12pt wider than the page
  // allows. Nothing re-normalised it, so the rightmost column silently ran into
  // the margin and the verifier caught it. The excess is taken back
  // proportionally from whichever columns have slack above the floor.
  const MIN_COL = 30;
  let w = widths.map((x) => (x / total) * CONTENT_W);
  w = w.map((x) => Math.max(x, MIN_COL));
  const excess = w.reduce((a, b) => a + b, 0) - CONTENT_W;
  if (excess > 0) {
    const slack = w.map((x) => Math.max(0, x - MIN_COL));
    const totalSlack = slack.reduce((a, b) => a + b, 0);
    if (totalSlack <= 0) {
      // Every column is at the floor. Fall back to a flat distribution rather
      // than letting the table overhang the page.
      w = w.map(() => CONTENT_W / w.length);
    } else {
      w = w.map((x, i) => x - excess * (slack[i] / totalSlack));
    }
  }

  // Compact mode is for reference tables: long lists of short rows, where 10pt
  // text and 20pt rows cost a page per fifty entries. A table of prose keeps 10pt,
  // because there the height is set by the text and shrinking the type buys
  // nothing but a harder read.
  //
  // The decision is made from the shape of the data rather than being asserted by
  // the caller at ninety call sites, and an explicit option always wins.
  const cellChars = rows.reduce((a, r) => a + r.join(' ').length, 0) / (rows.length * Math.max(1, head.length));
  const compact = o.compact !== undefined
    ? !!o.compact
    : (rows.length >= 6 && cellChars < 55);

  const PAD = compact ? 4 : 6;
  const HEAD_H = compact ? 17 : 22;
  const MIN_ROW = compact ? 14 : 20;
  const ROW_PAD = compact ? 6 : 10;

  const size = o.size || (compact ? TYPE.code : TYPE.table);
  const measureRow = (cells) => {
    const hs = cells.map((c, i) =>
      doc.font('Times-Roman').fontSize(size)
        .heightOfString(String(c ?? ''), { width: w[i] - 2 * PAD })
    );
    return Math.max(MIN_ROW, Math.ceil(Math.max(...hs)) + ROW_PAD);
  };

  const rowH = rows.map(measureRow);
  const headH = HEAD_H;
  const fullHeight = headH + rowH.reduce((a, b) => a + b, 0);

  // The caption sits directly above the table and moves with it.
  let captionH = 0;
  if (o.caption) {
    captionH = measure(doc, o.caption, { font: 'Times-Bold', size: TYPE.caption, width: CONTENT_W }) + 6;
  }

  const startPage = () => {
    doc.addPage();
    doc.y = M.top;
  };

  // A short table is moved whole rather than orphaned at the foot of a page.
  if (doc.y + captionH + fullHeight > TEXT_BOTTOM && M.top + fullHeight <= TEXT_BOTTOM) {
    startPage();
  } else if (doc.y + captionH + HEAD_H > TEXT_BOTTOM) {
    startPage();
  }

  if (o.caption) {
    doc.font('Times-Bold').fontSize(TYPE.caption).fillColor(INK)
      .text(o.caption, M.left, doc.y, { width: CONTENT_W });
    doc.y += captionH;
  }

  const drawHead = (y) => {
    fillBox(doc, M.left, y, CONTENT_W, headH);
    box(doc, M.left, y, CONTENT_W, headH, RULE.tableHead);
    let x = M.left;
    head.forEach((cell, i) => {
      if (i > 0) line(doc, x, y, x, y + headH, RULE.thin);
      doc.font('Times-Bold').fontSize(size).fillColor(INK)
        .text(String(cell), x + PAD, y + (compact ? 3 : 6),
          { width: w[i] - 2 * PAD, lineBreak: false, align: 'left' });
      x += w[i];
    });
    line(doc, M.left, y + headH, M.left + CONTENT_W, y + headH, RULE.tableHead);
  };

  let y = doc.y;
  let ri = 0;
  let part = 0;

  while (ri < rows.length) {
    drawHead(y);
    y += headH;

    let used = 0;
    let fit = 0;
    while (ri + fit < rows.length && used + rowH[ri + fit] <= TEXT_BOTTOM - y) {
      used += rowH[ri + fit];
      fit++;
    }
    if (fit === 0) fit = 1;   // one oversized row still has to be drawn

    for (let k = 0; k < fit; k++) {
      const idx = ri + k;
      const h = rowH[idx];
      let x = M.left;
      rows[idx].forEach((cell, i) => {
        doc.font('Times-Roman').fontSize(size).fillColor(INK)
          .text(String(cell ?? ''), x + PAD, y + (compact ? 2 : 5),
            { width: w[i] - 2 * PAD });
        x += w[i];
      });
      // row separator, which replaces the shading
      line(doc, M.left, y + h, M.left + CONTENT_W, y + h, RULE.table);
      x = M.left;
      for (let i = 1; i < w.length; i++) {
        x += w[i];
        line(doc, x, y, x, y + h, RULE.table);
      }
      line(doc, M.left, y, M.left, y + h, RULE.table);
      y += h;
    }

    ri += fit;
    part++;
    if (ri < rows.length) {
      startPage();
      y = doc.y;
      if (part > 1) {
        doc.font('Times-Italic').fontSize(9.5).fillColor(INK)
          .text('(table continued)', M.left, y, { width: CONTENT_W, lineBreak: false });
        y += 12;
      }
    }
  }

  // outer border
  doc.y = y;
  doc.x = M.left;
};

// ---------------------------------------------------------------- code
/**
 * A bordered code block, sized so the box and the text agree.
 *
 * The earlier version drew the background rectangle after the text, and measured
 * nothing at all, so a block that crossed a page boundary left a large empty
 * box behind. Here the height is computed first and the block is never split.
 */
const code = (ctx, lines, o = {}) => {
  const { doc } = ctx;
  if (!lines || !lines.length) return;
  if (ctx.setStat) ctx.setStat('codeBlocks', ctx.getStat().codeBlocks + 1);
  const size = o.size || TYPE.code;
  const PAD_X = 10;
  const PAD_Y = 8;
  const innerW = CONTENT_W - 2 * PAD_X;

  doc.font('Courier').fontSize(size);
  const lineH = doc.currentLineHeight(true);
  const widest = lines.reduce((m, l) => Math.max(m, doc.widthOfString(String(l))), 0);
  const h = PAD_Y * 2 + lines.length * lineH;
  const w = Math.min(Math.max(widest + PAD_X * 2, 220), CONTENT_W);

  const needCaption = o.caption
    ? measure(doc, o.caption, { font: 'Times-Bold', size: TYPE.caption, width: CONTENT_W }) + 5
    : 0;

  if (doc.y + needCaption + h > TEXT_BOTTOM) {
    doc.addPage();
    doc.y = M.top;
  }

  if (o.caption) {
    doc.font('Times-Bold').fontSize(TYPE.caption).fillColor(INK)
      .text(o.caption, M.left, doc.y, { width: CONTENT_W });
    doc.y += needCaption;
  }

  const top = doc.y;
  fillBox(doc, M.left, top, w, h);
  box(doc, M.left, top, w, h, RULE.table);

  doc.font('Courier').fontSize(size).fillColor(INK);
  let ty = top + PAD_Y;
  for (const raw of lines) {
    const text = String(raw);
    // never wrap code; a wrapped line is no longer the code that was written
    doc.text(text, M.left + PAD_X, ty, { width: innerW, lineBreak: false });
    ty += lineH;
  }

  doc.x = M.left;
  doc.y = top + h + 8;
};

// ---------------------------------------------------------------- callout
/**
 * A boxed note. Used for "what this code does" explanations under a block,
 * where a coloured tint would have done the job in the previous version.
 */
const note = (ctx, title, text) => {
  const { doc } = ctx;
  if (ctx.setStat) ctx.setStat('notes', ctx.getStat().notes + 1);
  const PAD = 10;
  const innerW = CONTENT_W - PAD * 2;
  const titleH = title
    ? measure(doc, title, { font: 'Times-Bold', size: TYPE.table + 0.5, width: innerW }) + 2
    : 0;
  const bodyH = measure(doc, text, { font: 'Times-Roman', size: TYPE.code, width: innerW, lineGap: 1.5 });
  const h = PAD * 2 + titleH + bodyH;

  if (doc.y + h > TEXT_BOTTOM) {
    doc.addPage();
    doc.y = M.top;
  }

  const top = doc.y;
  fillBox(doc, M.left, top, CONTENT_W, h);
  box(doc, M.left, top, CONTENT_W, h, RULE.table);

  let ty = top + PAD;
  if (title) {
    doc.font('Times-Bold').fontSize(TYPE.table + 0.5).fillColor(INK)
      .text(title, M.left + PAD, ty, { width: innerW });
    ty += titleH;
  }
  doc.font('Times-Roman').fontSize(TYPE.code).fillColor(INK)
    .text(text, M.left + PAD, ty, { width: innerW, align: 'justify', lineGap: 1.5 });

  doc.x = M.left;
  doc.y = top + h + 10;
};

const spacer = (ctx, pts) => { ctx.doc.y += pts; };

const pageBreak = (ctx) => { ctx.doc.addPage(); ctx.doc.y = M.top; };

module.exports = { h1, h2, h3, para, body, bullets, numbered, table, code, note, spacer, pageBreak, measure, keepWithNext };