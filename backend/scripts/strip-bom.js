// Strips UTF-8 BOMs from backend JS files.
//
// Several files were rewritten with PowerShell's Set-Content -Encoding UTF8,
// which on Windows PowerShell 5.1 prepends a BOM. Node tolerates a leading
// BOM, so nothing was broken, but it is invisible noise that shows up in diffs
// and confuses tooling. Safe to re-run.
const fs = require('fs');
const path = require('path');

const ROOTS = ['src', 'tests', 'scripts'];
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
let fixed = 0;

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full);
    } else if (/\.(js|jsx|json|sql)$/.test(entry.name)) {
      const buf = fs.readFileSync(full);
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        fs.writeFileSync(full, buf.subarray(3));
        console.log('  stripped BOM: ' + full);
        fixed++;
      }
    }
  }
};

ROOTS.forEach((r) => {
  if (fs.existsSync(r)) walk(r);
});

console.log(fixed === 0 ? 'no BOMs found' : `${fixed} file(s) cleaned`);
