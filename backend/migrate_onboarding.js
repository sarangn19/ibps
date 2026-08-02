const pool = require('./src/database/db');
require('dotenv').config();

const stmts = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS exam_goal TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS target_year INTEGER`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS prep_level TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_study_minutes INTEGER`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`
];

async function main() {
  const client = await pool.connect();
  try {
    for (const s of stmts) {
      await client.query(s);
      console.log('OK:', s);
    }
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`
    );
    console.log(cols.rows.map(r => `${r.column_name}:${r.data_type}`).join(', '));
  } finally {
    client.release();
    pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
