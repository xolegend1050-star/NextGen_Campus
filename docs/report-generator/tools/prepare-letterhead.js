/**
 * Converts the college letterhead to high contrast greyscale.
 *
 * The original scan is colour, which is correct for the institution's own use but
 * is the one thing in this report that would print as pale grey on a black and
 * white printer. Small coloured text is exactly what washes out first when a
 * document is photocopied, and the college name sitting at the top of every
 * front matter page has to be readable.
 *
 * The crest itself is kept as a recognisable shape rather than reduced to a flat
 * silhouette, so the letterhead still looks like the institution's own. Only the
 * tonal range is remapped: background to white, text to black, and the crest
 * midtones pulled apart so they survive a low toner printer.
 *
 * Run once. The result is committed as assets/letterhead.png.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SRC = path.join(__dirname, '..', 'assets', 'letterhead-source.png');
const OUT = path.join(__dirname, '..', 'assets', 'letterhead.png');

const src = PNG.sync.read(fs.readFileSync(SRC));

// The letterhead is mostly white paper. Treating the lightest few percent of the
// image as paper, rather than pure 255, stops the compression noise in the scan
// from being amplified into a grey wash across the whole page.
const lums = new Float64Array(src.width * src.height);
let maxL = 0;
for (let i = 0; i < src.width * src.height; i++) {
  const r = src.data[i * 4];
  const g = src.data[i * 4 + 1];
  const b = src.data[i * 4 + 2];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  lums[i] = l;
  if (l > maxL) maxL = l;
}

const out = new PNG({ width: src.width, height: src.height });

let histogram = new Array(256).fill(0);
for (const l of lums) histogram[Math.round(l)]++;

// 99.5th percentile is treated as the paper white point.
let acc = 0, whitePoint = 255;
const target = src.width * src.height * 0.995;
for (let v = 0; v < 256; v++) {
  acc += histogram[v];
  if (acc >= target) { whitePoint = v; break; }
}

const BLACK_POINT = Math.min(whitePoint * 0.34, 96);

// The scan carries a one pixel dark border down its right edge. It prints as a
// stray hairline beside the letterhead on the cover, which is only visible once
// the pages are looked at rather than measured. The outermost two pixels are
// forced to paper, which removes the border without touching the letterhead.
const EDGE = 2;

let dark = 0, mid = 0, light = 0;
for (let i = 0; i < lums.length; i++) {
  const x = i % src.width;
  const y = (i / src.width) | 0;
  const onEdge = x < EDGE || x >= src.width - EDGE || y < EDGE || y >= src.height - EDGE;
  let v = lums[i];
  if (onEdge) v = 255;
  else if (v >= whitePoint) v = 255;
  else if (v <= BLACK_POINT) v = 0;
  else {
    // Linear stretch between the two anchors: BLACK_POINT becomes black,
    // whitePoint becomes white. A straight ramp would keep the crest as a flat
    // grey blob with no internal detail, so the range is stretched rather than
    // merely clipped.
    const t = (v - BLACK_POINT) / (whitePoint - BLACK_POINT);
    v = Math.round(255 * t);
  }
  const o = i * 4;
  out.data[o] = v;
  out.data[o + 1] = v;
  out.data[o + 2] = v;
  out.data[o + 3] = src.data[o + 3];

  if (v < 64) dark++; else if (v < 200) mid++; else light++;
}

fs.writeFileSync(OUT, PNG.sync.write(out));

const px = src.width * src.height;
console.log('  source        : letterhead-source.png  ' + src.width + ' x ' + src.height + '  (colour)');
console.log('  white point   : ' + whitePoint);
console.log('  black point   : ' + BLACK_POINT);
console.log('  dark pixels   : ' + (100 * dark / px).toFixed(1) + '%');
console.log('  mid  pixels   : ' + (100 * mid / px).toFixed(1) + '%  (crest detail)');
console.log('  light pixels  : ' + (100 * light / px).toFixed(1) + '%');
console.log('  written       : assets/letterhead.png  (greyscale, high contrast)');