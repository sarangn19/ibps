const pool = require('../database/db');

// Self-migrating: adds referral columns to users. Runs on registration and
// admin referral queries so deploys apply automatically.
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users (referral_code) WHERE referral_code IS NOT NULL`);
    await backfillCodes();
  } finally {
    client.release();
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const CODE_LENGTH = 6;

// Assign a unique referral code to any user that doesn't have one yet.
async function backfillCodes() {
  const missing = await pool.query(
    'SELECT id FROM users WHERE referral_code IS NULL OR referral_code = \'\''
  );
  for (const row of missing.rows) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateCode();
      const clash = await pool.query('SELECT id FROM users WHERE referral_code = ?', [code]);
      if (clash.rows.length > 0) continue;
      await pool.query('UPDATE users SET referral_code = ? WHERE id = ?', [code, row.id]);
      break;
    }
  }
}

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Returns a fresh, unique code for a new user (call before INSERT).
async function nextUniqueCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    const clash = await pool.query('SELECT id FROM users WHERE referral_code = ?', [code]);
    if (clash.rows.length === 0) return code;
  }
  throw new Error('Could not generate a unique referral code');
}

// Resolve a submitted referral code to a user id (null if unknown/invalid).
async function resolveReferrer(code) {
  if (!code || typeof code !== 'string') return null;
  const result = await pool.query('SELECT id FROM users WHERE referral_code = ?', [String(code).trim().toUpperCase()]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// Referral counts for a user (how many people they brought, paid vs unpaid).
// Paid = a referred user with an active monthly (paying) subscription.
async function getReferralStats(userId) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users r WHERE r.referred_by = ?) AS total,
       (SELECT COUNT(*) FROM users r
        WHERE r.referred_by = ? AND r.subscription_plan = 'monthly' AND r.subscription_status = 'active') AS paid
     `,
    [userId, userId]
  );
  const row = result.rows[0];
  const total = Number(row.total || 0);
  const paid = Number(row.paid || 0);
  return { total, paid, unpaid: total - paid };
}

// Detail list of the users someone referred.
async function getReferredUsers(userId) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, name, email, created_at, subscription_status, subscription_plan, subscription_ends_at
     FROM users
     WHERE referred_by = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map((r) => ({
    ...r,
    is_paid: r.subscription_plan === 'monthly' && r.subscription_status === 'active'
  }));
}

// Info about who referred a user (null if nobody did).
async function getReferrer(userId) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.referral_code, u.created_at
     FROM users u
     JOIN users me ON me.referred_by = u.id
     WHERE me.id = ?`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  ensureSchema,
  generateCode,
  nextUniqueCode,
  resolveReferrer,
  getReferralStats,
  getReferredUsers,
  getReferrer
};
