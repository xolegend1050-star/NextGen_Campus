/**
 * Layout engine for the NextGen Campus black book.
 *
 * Designed for black and white printing, which rules out the way the previous
 * version was built. That one used five colours, shaded table rows and coloured
 * rules, and set 8.5pt text in about ten thousand places, which is fine on a
 * screen and unreadable once photocopied. Everything here is therefore:
 *
 *   - pure black on white, with no greys at all, so nothing can wash out
 *   - hierarchy carried by size, weight and rules rather than by hue
 *   - every table fully bordered, which is what replaces the shading
 *   - 12pt body text, and nothing anywhere below 9pt
 *
 * Pagination is enforced at every flow rather than checked afterwards. PDFKit
 * starts a new page whenever text is written below the bottom margin, even at an
 * explicit y, which is how the previous build produced pages carrying nothing
 * but a header.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const MM = 72 / 25.4;

// ---------------------------------------------------------------- geometry
const PAGE = { W: 595.28, H: 841.89 };          // A4
const M = {
  top: 22 * MM,
  bottom: 20 * MM,
  left: 28 * MM,      // wider, for the binding edge
  right: 20 * MM
};
const CONTENT_W = PAGE.W - M.left - M.right;
const BOTTOM = PAGE.H - M.bottom;
const TEXT_BOTTOM = BOTTOM - 26;                  // clear of the footer rule

// ---------------------------------------------------------------- ink
// The entire document is these two values. There is no palette, on purpose.
const INK = '#000000';
const PAPER = '#FFFFFF';

// ---------------------------------------------------------------- type
const TYPE = {
  h1: 17,
  h2: 13,
  h3: 12,
  body: 12,
  table: 10,
  tableHead: 10,
  code: 9.5,
  caption: 10,
  index: 12,
  indexSub: 10.5,
  running: 9.5
};

// Absolute floor. Photocopying thins strokes and small sizes first, so anything
// at or below this is a liability in a printed submission.
const MIN_PT = 9;

// ---------------------------------------------------------------- rules
const RULE = {
  heavy: 1.6,
  chapter: 1.2,
  thin: 0.5,
  hair: 0.4,
  table: 0.5,
  tableHead: 0.9
};

const makeDoc = (file, meta = {}) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: M,
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: meta.title || 'Project Report',
      Author: meta.author || '',
      Subject: meta.subject || '',
      Keywords: 'black book, project report'
    }
  });
  // The caller needs the file stream, not the document. Waiting on the document's
  // own "end" event resolves while the bytes are still sitting in the stream's
  // buffer, so reading the PDF straight afterwards gets a truncated file and an
  // "Invalid PDF structure" error from the parser. The stream is exposed so the
  // caller can wait for "finish" instead.
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);
  doc.fileStream = stream;
  return doc;
};

const pageCount = (doc) => {
  const r = doc.bufferedPageRange();
  return r.start + r.count;
};

/** Guarantee at least `need` points of room, breaking the page if not. */
const ensure = (doc, need) => {
  if (doc.y + need > TEXT_BOTTOM) {
    doc.addPage();
    doc.y = M.top;
    return true;
  }
  return false;
};

module.exports = {
  PDFDocument, fs, path, MM,
  PAGE, M, CONTENT_W, BOTTOM, TEXT_BOTTOM,
  INK, PAPER, TYPE, MIN_PT, RULE,
  makeDoc, pageCount, ensure
};