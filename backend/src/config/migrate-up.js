// Applies backend/migrations/*.sql in filename order, tracking what has run
// in a schema_migrations table so re-running is safe.
// Run from anywhere: npm run migrate:up
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('./database');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await db.query('SELECT filename FROM schema_migrations');
  const done = new Set(applied.rows.map(r => r.filename));

  let ran = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`  skip   ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.withTransaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      });
      console.log(`  APPLY  ${file}`);
      ran++;
    } catch (err) {
      console.error(`  FAIL   ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n${ran} migration(s) applied, ${done.size} already present.`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
