const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'ibps.db');

// Ensure directory exists
const fs = require('fs');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const query = (sql, params = []) => {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  const isSelect = upper.startsWith('SELECT');
  const hasReturning = upper.includes('RETURNING');

  const stmt = db.prepare(sql);

  if (isSelect || hasReturning) {
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
    return { rows, rowCount: rows.length };
  }

  const info = params.length > 0 ? stmt.run(...params) : stmt.run();
  return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
};

module.exports = { query, db };
