const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  family: 4,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err.message);
});

const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test passed:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    console.error('   Connection string host:', connectionString ? connectionString.split('@')[1]?.split(':')[0] : 'NOT SET');
  }
};

// Only test connection when explicitly required
// testConnection();

/**
 * Run a function inside a transaction, committing on success and rolling back
 * on any throw. Use `client.query` rather than the pool inside the callback so
 * every statement joins the same transaction.
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('❌ Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
  pool,
};
