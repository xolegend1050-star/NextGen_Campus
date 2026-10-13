/**
 * Prepares captured screenshots for the report.
 *
 * Screenshots are the one place this document is allowed colour, because a picture
 * of an interface is meaningless without it. This step therefore does NOT desaturate
 * anything. It sizes and compresses for print, and reports what it did so the
 * decision is visible rather than assumed.
 *
 * What it enforces:
 *
 *   - Width is capped at 150 dpi across the widest a figure is drawn. Anything
 *     larger is wasted ink and a larger file for no visible gain on paper.
 *   - Height is capped so a tall screenshot cannot take a whole page and cannot
 *     be scaled so small that its interface text falls under the 9pt floor the
 *     rest of the document holds to.
 *   - A screenshot that is very dark or very light is reported, because either one
 *     prints badly even when it looks fine on a screen.
 *
 * Usage: drop PNGs into shots/ and run `npm run shots`.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SHOTS = path.join(__dirname, '..', 'shots');
const OUT = path.join(__dirname, '..', 'assets', 'figures');

// A4 text block is 459pt wide. A figure is drawn at 82% of it, so 376pt.
// At 150 dpi that is 376 / 72 * 150 = 783 px. Anything past 1200 px is wasted.
const MAX_W = 1200;
const MIN_W = 520;          // below this, drawn text approaches the 9pt floor

const files = fs.existsSync(SHOTS)
  ? fs.readdirSync(SHOTS).filter((f) => /\.(png|PNG)$/.test(f)).sort()
  : [];

if (!files.length) {
  console.log('  no screenshots found in shots/');
  console.log('  put full-page captures there as PNGs and run this again');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });

files.forEach((name) => {
  const src = fs.readFileSync(path.join(SHOTS, name));
  const img = PNG.sync.read(src);

  let scale = 1;
  if (img.width > MAX_W) scale = MAX_W / img.width;

  let outW = Math.round(img.width * scale);
  let outH = Math.round(img.height * scale);

  const dst = new PNG({ width: outW, height: outH });
  let sum = 0, dark = 0, light = 0;
  const n = outW * outH;

  for (let y = 0; y < outH; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale));
      const si = (sy * img.width + sx) * 4;
      const di = (y * outW + x) * 4;
      const r = img.data[si], g = img.data[si + 1], b = img.data[si + 2];
      dst.data[di] = r; dst.data[di + 1] = g; dst.data[di + 2] = b;
      dst.data[di + 3] = 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      if (l < 40) dark++;
      else if (l > 235) light++;
    }
  }

  const mean = sum / n;
  const darkPct = (100 * dark) / n;
  const lightPct = (100 * light) / n;

  const outName = name.replace(/\.(png|PNG)$/, '');
  const outFile = path.join(OUT, outName + '.png');
  fs.writeFileSync(outFile, PNG.sync.write(dst, { deflateLevel: 9 }));

  const before = Math.round(src.length / 1024);
  const after = Math.round(fs.statSync(outFile).size / 1024);

  console.log('  ' + outName);
  console.log('      ' + img.width + 'x' + img.height + '  ->  ' + outW + 'x' + outH +
    '   (' + before + ' KB -> ' + after + ' KB, colour kept)');
  console.log('      mean luminance ' + Math.round(mean) +
    ',  ' + darkPct.toFixed(1) + '% near black,  ' + lightPct.toFixed(1) + '% near white');

  if (outW < MIN_W) {
    console.log('      WARNING: narrow. Drawn at this width its interface text will fall');
    console.log('               below the 9pt floor. Capture at full window width.');
  }
  if (mean < 60) {
    console.log('      WARNING: very dark image. Prints as a solid block with no detail.');
  }
  if (mean > 230 && lightPct > 70) {
    console.log('      WARNING: very light image. Prints almost empty on paper.');
  }
});

console.log('\n  written to assets/figures/');
console.log('  reference them from a content file with:');
console.log("    figure(ctx, '8', 'Landing page', { file: require('path')");
console.log("      .join(__dirname, '..', 'assets', 'figures', '<name>.png') })");