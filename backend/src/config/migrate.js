const fs = require('fs');
const path = require('path');
const db = require('./database');
const logger = require('../utils/logger');

async function migrate() {
  logger.info('Starting database migration...');

  try {
    const schemaPath = path.join(__dirname, 'database.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolons and filter out empty statements
    // Handle $$ delimiters properly
    const statements = [];
    let current = '';
    let inDollarQuote = false;

    for (const line of schema.split('\n')) {
      if (line.includes('$$')) {
        const count = (line.match(/\$\$/g) || []).length;
        if (count % 2 === 1) {
          inDollarQuote = !inDollarQuote;
        }
      }
      current += line + '\n';
      if (!inDollarQuote && line.trim().endsWith(';')) {
        statements.push(current.trim());
        current = '';
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    let executed = 0;
    for (const stmt of statements) {
      if (!stmt || stmt.startsWith('--') || stmt === ';') continue;
      try {
        await db.query(stmt);
        executed++;
      } catch (err) {
        // Ignore duplicate/already-exists errors (code 42710 = duplicate_table, 42P07 = duplicate_object)
        if (['42710', '42P07', '42P16'].includes(err.code)) {
          logger.warn(`Skipping (already exists): ${err.message}`);
        } else {
          logger.error(`Migration error on statement: ${err.message}`);
          logger.error(`Statement preview: ${stmt.substring(0, 100)}...`);
        }
      }
    }

    logger.info(`Migration complete. Executed ${executed} statements.`);
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
