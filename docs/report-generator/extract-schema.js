/**
 * Reads the real schema out of database.sql and the migrations, and writes JSON.
 *
 * The data dictionary appendix is generated from this. The column types are
 * matched against the actual Postgres type names rather than a loose pattern:
 * a generic "letters and spaces" pattern is lazy and stops after the first
 * character, which silently turned uuid into "u" and text into "t" in an earlier
 * version of this extractor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..', 'backend');
const SQL = path.join(ROOT, 'src', 'config', 'database.sql');
const MIG_DIRS = [path.join(ROOT, 'migrations'), path.join(ROOT, 'src', 'config')];

const stripComments = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const statements = (text) => {
  const out = [];
  let cur = '';
  let inStr = false;
  for (const ch of text) {
    if (ch === "'") inStr = !inStr;
    if (ch === ';' && !inStr) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const TYPE = /^\s*((?:timestamp|time|double\s+precision|character\s+varying|character|bit\s+varying|bit|varbit|numeric|decimal|bigint|bigserial|smallint|smallserial|integer|serial|boolean|bool|jsonb|json|uuid|text|varchar|date|interval|real|float4|float8|money|bytea|inet|cidr|xml)(?:\s+with(?:out)?\s+time\s+zone)?(?:\s*\(\s*[\d,\s]*\s*\))?(?:\[\])?)(?!\S)/i;
const CONSTRAINT = /^(primary key|foreign key|unique|check|constraint|exclude)\b/i;

const parseCreateTable = (stmt) => {
  const head = stmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i);
  if (!head) return null;
  let name = head[1].replace(/"/g, '');
  if (name.includes('.')) name = name.split('.').pop();

  const open = stmt.indexOf('(');
  if (open === -1) return null;
  let depth = 0, end = -1, inStr = false;
  for (let i = open; i < stmt.length; i++) {
    const ch = stmt[i];
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (!depth) { end = i; break; } }
  }
  if (end === -1) return null;

  const inner = stmt.slice(open + 1, end);
  const parts = [];
  let nesting = 0, cur = '', q = false;
  for (const ch of inner) {
    if (ch === "'") q = !q;
    if (!q) { if (ch === '(') nesting++; else if (ch === ')') nesting--; }
    if (ch === ',' && !nesting && !q) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const cols = [];
  for (const part of parts) {
    const line = part.trim();
    if (!line || CONSTRAINT.test(line)) continue;
    const cm = line.match(/^"?([\w]+)"?\s+([\s\S]+)$/);
    if (!cm) continue;
    const def = cm[2].trim().replace(/\s+/g, ' ');
    const tm = def.match(TYPE);
    const type = tm ? tm[1].trim().toLowerCase().replace(/\s+/g, ' ') : def.split(/\s+/)[0].toLowerCase();

    const flags = [];
    if (/\bnot\s+null\b/i.test(def)) flags.push('required');
    if (/\bprimary key\b/i.test(def)) flags.push('PK');
    if (/\bunique\b/i.test(def)) flags.push('unique');
    const dm = def.match(/\bdefault\s+([^\s,]+(?:\s*\(\s*\))?)/i);
    if (dm) flags.push('default ' + dm[1].replace(/'/g, ''));
    const fk = def.match(/references\s+([\w."]+)\s*\(\s*"?([\w]+)"?\s*\)/i);
    if (fk) flags.push('FK → ' + fk[1].replace(/"/g, '').split('.').pop() + '(' + fk[2] + ')');
    if (/\bon\s+delete\s+(cascade|set\s+null|restrict|no\s+action)/i.test(def)) {
      flags.push('ON DELETE ' + def.match(/on\s+delete\s+([a-z ]+)/i)[1].toUpperCase().trim());
    }
    if (/\b(generated|identity)\b/i.test(def)) flags.push('generated');

    cols.push({ name: cm[1], type, flags });
  }
  return { table: name, columns: cols };
};

let text = stripComments(fs.readFileSync(SQL, 'utf8'));
for (const dir of MIG_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql') && x !== 'database.sql')) {
    text += '\n\n-- ==== ' + path.basename(dir) + '/' + f + ' ====\n' + stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
}

const stmts = statements(text);
const byName = new Map();
for (const s of stmts) {
  if (!/^\s*create\s+table/i.test(s)) continue;
  const t = parseCreateTable(s);
  if (t && t.columns.length) byName.set(t.table, t);   // last definition wins
}
const tables = [...byName.values()].sort((a, b) => a.table.localeCompare(b.table));

const indexes = [];
for (const s of stmts) {
  const m = s.match(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([\w]+)\s+on\s+([\w]+)\s*(?:using\s+\w+\s*)?\(([^)]+)\)/i);
  if (m) indexes.push({ name: m[1], table: m[2].replace(/"/g, ''), cols: m[3].replace(/"/g, '').trim() });
}

const triggerSet = new Set();
for (const s of stmts) {
  const m = s.match(/create\s+(?:or\s+replace\s+)?trigger\s+([\w]+)/i);
  if (m) triggerSet.add(m[1]);
}
const triggers = [...triggerSet].sort();

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'data', 'db-schema.json'),
  JSON.stringify({ tables, indexes, triggers }, null, 1));

const colCount = tables.reduce((a, t) => a + t.columns.length, 0);
console.log('  tables   : ' + tables.length);
console.log('  columns  : ' + colCount);
console.log('  indexes  : ' + indexes.length);
console.log('  triggers : ' + triggers.length);
console.log('  written  : data/db-schema.json');