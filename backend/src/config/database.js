const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let connectionString = process.env.DATABASE_URL;

if (connectionString) {
  const isIPv6Host = connectionString.includes('.supabase.co') &&
    !connectionString.includes('pooler');

  if (isIPv6Host && process.env.NODE_ENV === 'production') {
    connectionString = connectionString
      .replace(/@db\./, '@aws-0-ap-south-1.pooler.')
      .replace(/:5432/, ':6543');
    console.log('🔄 Using Supabase pooler (IPv4) for production');
  }
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
