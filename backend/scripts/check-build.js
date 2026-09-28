// Pre-deploy sanity check.
//
// A merge once concatenated an identical block into backend/src/routes/chat.js,
// duplicating four top-level const declarations. That is a fatal SyntaxError,
// so the server could not start and every deploy failed. Neither `npm install`
// nor eslint caught it, because neither parses the files.
//
// This runs both checks that the normal build skips:
//   1. every .js file parses
//   2. no duplicate top-level declarations or duplicate Express routes
//
// Run: node scripts/check-build.js   (from backend/)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOTS = ['src', 'tests'];
const files = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
};

ROOTS.forEach((r) => {
  if (fs.existsSync(r)) walk(r);
});

let problems = 0;
const fail = (msg) => {
  console.log(msg);
  problems++;
};

// A top-level declaration is one at column 0 (no leading indentation).
const DECL = /^const\s+([A-Za-z_$][\w$]*)\s*=/;
const ROUTE = /^router\.(get|post|put|patch|delete)\(\s*'([^']*)'/;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const rel = file.replace(process.cwd() + path.sep, '');

  // 1. parse
  try {
    // eslint-disable-next-line no-new
    new vm.Script(source, { filename: rel });
  } catch (err) {
    fail(`SYNTAX      ${rel}: ${err.message}`);
  }

  // 2. duplicates
  const lines = source.split(/\r?\n/);
  const decls = new Map();
  const routes = new Map();

  lines.forEach((line, i) => {
    const d = line.match(DECL);
    if (d) {
      if (!decls.has(d[1])) decls.set(d[1], []);
      decls.get(d[1]).push(i + 1);
    }
    const r = line.match(ROUTE);
    if (r) {
      const key = `${r[1].toUpperCase()} ${r[2]}`;
      if (!routes.has(key)) routes.set(key, []);
      routes.get(key).push(i + 1);
    }
  });

  for (const [name, where] of decls) {
    if (where.length > 1) {
      fail(`DUPLICATE   ${rel}: const ${name} at lines ${where.join(', ')}`);
    }
  }
  for (const [key, where] of routes) {
    if (where.length > 1) {
      fail(`DUPLICATE   ${rel}: ${key} at lines ${where.join(', ')}`);
    }
  }
}

console.log(`\nchecked ${files.length} files`);
if (problems === 0) {
  console.log('OK - all files parse, no duplicates');
  process.exit(0);
}
console.log(`${problems} problem(s) found`);
process.exit(1);
