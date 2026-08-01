const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to backend/.env (Supabase > Settings > Database > Session pooler URI).');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DB_SSL === 'off' ? false : { rejectUnauthorized: false }
});

// Controllers were written with `?` placeholders (SQLite style); Postgres needs $1, $2, ...
function translate(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Mirrors the previous wrapper's shape: { rows, rowCount, lastInsertRowid }
async function query(sql, params = []) {
  const result = await pool.query(translate(sql), params);
  const rows = result.rows || [];
  const lastInsertRowid = rows.length ? rows[0].id : undefined;
  return { rows, rowCount: result.rowCount, lastInsertRowid };
}

query.query = query;
query.pool = pool;
query.db = pool;
query.connect = pool.connect.bind(pool);
query.end = pool.end.bind(pool);

module.exports = query;
