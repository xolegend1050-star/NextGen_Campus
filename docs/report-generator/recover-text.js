/**
 * Reads the previous PDF and reports what can be recovered from it.
 *
 * The generator that produced it lived in a temporary folder and was deleted, so
 * this establishes how much of the prose survives in the text layer before
 * anything is rewritten. Anything listed as missing here would have to be
 * written fresh rather than recovered.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node recover-text.js <pdf path>');
  process.exit(2);
}

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(SRC));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  console.log('  source        : ' + SRC);
  console.log('  pages         : ' + doc.numPages);

  const pages = [];
  let words = 0;
  let minFont = Infinity;
  const sizes = new Map();
  const images = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let text = '';
    for (const item of tc.items) {
      if (!item.str) continue;
      text += item.str + (item.hasEOL ? '\n' : ' ');
      const size = Math.round((item.height || 0) * 10) / 10;
      if (size > 0 && size < 200) {
        minFont = Math.min(minFont, size);
        sizes.set(size, (sizes.get(size) || 0) + item.str.length);
      }
      words += item.str.split(/\s+/).filter(Boolean).length;
    }
    pages.push({ page: p, text });
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === 85) {
        const name = ops.argsArray[i][0];
        try {
          const im = await page.objs.get(name);
          if (im && im.width) images.push({ page: p, w: im.width, h: im.height });
        } catch { /* not all XObjects are images */ }
      }
    }
  }

  const all = pages.map((x) => x.text).join('\n');
  const out = path.join(__dirname, 'recovered', 'pages.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pages.map((x) => `@@PAGE${x.page}\n${x.text}`).join('\n'), 'utf8');

  console.log('  words         : ' + words.toLocaleString());
  console.log('  smallest text : ' + (minFont === Infinity ? 'n/a' : minFont.toFixed(1) + 'pt'));
  console.log('  images        : ' + images.length +
    (images.length ? '  (first: p' + images[0].page + ' ' + images[0].w + 'x' + images[0].h + ')' : ''));
  console.log('  written       : ' + out);

  // Font sizes actually used, largest first, so the redesign can see what sizes
  // the old document relied on.
  console.log('\n  font sizes in use:');
  [...sizes.entries()].sort((a, b) => b[0] - a[0]).forEach(([size, chars]) => {
    console.log('    ' + String(size).padStart(6) + 'pt   ' + String(chars).padStart(7) + ' chars');
  });

  // Chapter headings, to confirm the structure survived
  const chapters = all.match(/Chapter\s+\d+:\s*[A-Za-z &]+/g) || [];
  const uniq = [...new Set(chapters)];
  console.log('\n  chapters found: ' + uniq.length);
  uniq.slice(0, 12).forEach((c) => console.log('    ' + c.trim()));

  // Blank page check on the old document
  const blank = pages.filter((x) => x.text.replace(/\s+/g, '').length < 25);
  console.log('\n  near blank pages: ' + blank.length +
    (blank.length ? '  -> ' + blank.map((b) => b.page).join(', ') : ''));

  process.exit(0);
})().catch((e) => {
  console.error('  FAILED: ' + e.message);
  process.exit(1);
});