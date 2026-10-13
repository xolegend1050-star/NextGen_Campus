/**
 * Reads the real Express route table out of the backend and writes JSON.
 *
 * The API reference appendix is generated from this rather than written by hand,
 * so it cannot quietly disagree with the code it documents. Running this after a
 * change and rebuilding is the whole point: if a route is added, the appendix
 * grows, and if one is removed the appendix shrinks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..', 'backend');
const ROUTES = path.join(ROOT, 'src', 'routes');
const SERVER = path.join(ROOT, 'src', 'server.js');

const readMounts = () => {
  const src = fs.readFileSync(SERVER, 'utf8');
  const mounts = {};
  const re = /app\.use\(\s*'([^']*)'\s*,\s*(\w+)\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const prefix = (m[1] || '').replace(/\/$/, '');
    const decl = src.match(new RegExp("const\\s+" + m[2] + "\\s*=\\s*require\\('\\./routes/(\\w+)'\\)"));
    if (decl) mounts[decl[1]] = prefix;
  }
  return mounts;
};

const DECL = /router\.(get|post|put|patch|delete)\(\s*'([^']*)'([\s\S]*?)\);\s*$/gm;

const parseFile = (file, prefix) => {
  const src = fs.readFileSync(path.join(ROUTES, file), 'utf8');
  const out = [];

  // router.use(authenticate, authorize('admin')) guards a whole file, so it has to
  // be folded into each route or every admin endpoint would be reported public.
  const useM = src.match(/^router\.use\(([^;]*)\);/m);
  const routerAuth = useM ? /authenticate/.test(useM[1]) : false;
  const routerRolesM = useM ? useM[1].match(/authorize\(\s*'([^']+)'/) : null;

  let m;
  DECL.lastIndex = 0;
  while ((m = DECL.exec(src))) {
    const [, method, routePath, rest] = m;
    const rolesM = rest.match(/authorize\(\s*'([^']+)'/g);
    const roles = rolesM
      ? [...new Set(rolesM.map((r) => r.match(/'([^']+)'/)[1]))].join(', ')
      : (routerAuth && routerRolesM ? routerRolesM[1] : null);

    out.push({
      method: method.toUpperCase(),
      path: (prefix + routePath).replace(/\/+$/, '') || '/',
      module: file.replace(/\.js$/, ''),
      auth: routerAuth || /authenticate/.test(rest),
      roles: roles,
      validates: /Validation/.test(rest) || /uuidParams|intQueries|skillNameParam/.test(rest),
      handler: (rest.match(/(\w+Controller)\.(\w+)/) || [])[2] || ''
    });
  }
  return out;
};

const mounts = readMounts();
const all = [];
for (const file of fs.readdirSync(ROUTES).filter((f) => f.endsWith('.js'))) {
  const mod = file.replace(/\.js$/, '');
  if (mounts[mod] === undefined) {
    console.warn('  ! no mount prefix for ' + file + ', skipped');
    continue;
  }
  all.push(...parseFile(file, mounts[mod]));
}

all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
// The directory is created here rather than relying on the schema extractor having
// run first. When it was missing, running this script alone failed, and the
// symptom the next time round was not an error at all: the build produced a
// fourteen page shorter report with an empty API appendix and reported success.
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'data', 'api-routes.json'), JSON.stringify(all, null, 1));

const byMethod = all.reduce((a, r) => ((a[r.method] = (a[r.method] || 0) + 1), a), {});
const modules = [...new Set(all.map((r) => r.module))].sort();

console.log('  endpoints : ' + all.length + '  (' + Object.entries(byMethod).map(([k, v]) => k + ' ' + v).join(', ') + ')');
console.log('  modules   : ' + modules.length);
console.log('  guarded   : auth=' + all.filter((r) => r.auth).length +
  '  role limited=' + all.filter((r) => r.roles).length +
  '  validating=' + all.filter((r) => r.validates).length);
console.log('  written   : data/api-routes.json');