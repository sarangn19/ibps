const pool = require('../database/db');

const TRIAL_DAYS = 14;
const MONTHLY_PRICE = 129;
const DAY_MS = 24 * 60 * 60 * 1000;

// Self-migrating: adds subscription columns to users. Runs on boot and before
// admin subscription operations so deploys apply automatically.
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_granted_by INTEGER`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_granted_at TEXT`);
  } finally {
    client.release();
  }
}

// Users.created_at is stored as 'YYYY-MM-DD HH24:MI:SS' (server/UTC); subscription
// dates are stored as ISO 8601. Normalise both to a Date.
function parseDate(value) {
  if (!value) return null;
  const s = String(value);
  const d = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? new Date(s.replace(' ', 'T') + 'Z')
    : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Compute the effective access state for a user row (fresh from DB).
function computeAccess(user) {
  const now = Date.now();
  const isStaff = user.role === 'admin' || user.role === 'superadmin';

  const base = {
    trial_started_at: user.created_at || null,
    granted_by: user.subscription_granted_by ?? null,
    granted_at: user.subscription_granted_at || null,
    amount_per_month: MONTHLY_PRICE
  };

  if (isStaff) {
    return {
      ...base,
      allowed: true,
      plan: 'staff',
      status: 'active',
      trial_ends_at: null,
      trial_days_left: null,
      ends_at: null
    };
  }

  // Paid or admin-granted active subscription.
  if (user.subscription_status === 'active') {
    const endsAt = parseDate(user.subscription_ends_at);
    if (endsAt === null || endsAt.getTime() > now) {
      return {
        ...base,
        allowed: true,
        plan: user.subscription_plan || 'monthly',
        status: 'active',
        trial_ends_at: null,
        trial_days_left: null,
        ends_at: user.subscription_ends_at || null
      };
    }
    return {
      ...base,
      allowed: false,
      plan: 'expired',
      status: 'expired',
      trial_ends_at: null,
      trial_days_left: 0,
      ends_at: user.subscription_ends_at || null
    };
  }

  // Free trial based on registration time.
  const createdAt = parseDate(user.created_at);
  const trialEnds = createdAt ? createdAt.getTime() + TRIAL_DAYS * DAY_MS : now + TRIAL_DAYS * DAY_MS;
  const daysLeft = Math.ceil((trialEnds - now) / DAY_MS);

  if (now <= trialEnds) {
    return {
      ...base,
      allowed: true,
      plan: 'trial',
      status: 'trial',
      trial_ends_at: new Date(trialEnds).toISOString(),
      trial_days_left: Math.max(daysLeft, 1),
      ends_at: null
    };
  }

  return {
    ...base,
    allowed: false,
    plan: 'expired',
    status: 'expired',
    trial_ends_at: new Date(trialEnds).toISOString(),
    trial_days_left: 0,
    ends_at: null
  };
}

async function getAccessForUser(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (result.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });
  return computeAccess(result.rows[0]);
}

// Express middleware. Loads a fresh user row and blocks students whose trial or
// subscription has lapsed. Admins/superadmins always pass.
async function requireAccess(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, role, created_at, subscription_status, subscription_plan,
              subscription_ends_at, subscription_granted_by, subscription_granted_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = result.rows[0];
    const access = computeAccess(user);
    req.user = { ...req.user, role: user.role, access };
    if (access.allowed) return next();
    return res.status(403).json({
      error: 'Subscription required to access this feature',
      code: 'SUBSCRIPTION_REQUIRED',
      access
    });
  } catch (error) {
    console.error('requireAccess error:', error);
    return res.status(500).json({ error: 'Failed to check access' });
  }
}

// Soft monthly subscription (no live payment gateway yet). Extends from the
// current expiry when an active subscription already exists.
async function subscribeMonthly(userId) {
  await ensureSchema();
  const result = await pool.query(
    'SELECT subscription_status, subscription_ends_at FROM users WHERE id = ?',
    [userId]
  );
  if (result.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });

  const now = Date.now();
  const currentEnd = parseDate(result.rows[0].subscription_ends_at);
  const from = currentEnd && currentEnd.getTime() > now ? currentEnd.getTime() : now;
  const endsAt = new Date(from + 30 * DAY_MS).toISOString();

  await pool.query(
    'UPDATE users SET subscription_status = ?, subscription_plan = ?, subscription_ends_at = ?, subscription_granted_by = NULL, subscription_granted_at = NULL WHERE id = ?',
    ['active', 'monthly', endsAt, userId]
  );
  return getAccessForUser(userId);
}

// Admin grants free access. durationDays null/0 => lifetime.
async function grantFree(userId, durationDays, adminId) {
  await ensureSchema();
  const result = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
  if (result.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });

  const days = parseInt(durationDays, 10);
  const endsAt = days > 0 ? new Date(Date.now() + days * DAY_MS).toISOString() : null;
  await pool.query(
    `UPDATE users SET subscription_status = ?, subscription_plan = ?,
       subscription_ends_at = ?, subscription_granted_by = ?, subscription_granted_at = ?
     WHERE id = ?`,
    ['active', 'granted_free', endsAt, adminId, new Date().toISOString(), userId]
  );
  return getAccessForUser(userId);
}

// Admin revokes a granted free subscription. Falls back to trial/expired based on
// the registration date.
async function revokeGrant(userId) {
  await ensureSchema();
  const result = await pool.query('SELECT created_at FROM users WHERE id = ?', [userId]);
  if (result.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });

  const createdAt = parseDate(result.rows[0].created_at);
  const trialEnds = createdAt ? createdAt.getTime() + TRIAL_DAYS * DAY_MS : Date.now();
  const status = Date.now() <= trialEnds ? 'trial' : 'expired';

  await pool.query(
    `UPDATE users SET subscription_status = ?, subscription_plan = NULL,
       subscription_ends_at = NULL, subscription_granted_by = NULL, subscription_granted_at = NULL
     WHERE id = ?`,
    [status, userId]
  );
  return getAccessForUser(userId);
}

// Admin list of students with computed access state.
async function listStudents() {
  await ensureSchema();
  const result = await pool.query(`
    SELECT u.id, u.name, u.email, u.batch_id, u.created_at,
           u.subscription_status, u.subscription_plan, u.subscription_ends_at,
           u.subscription_granted_by, u.subscription_granted_at,
           b.name AS batch_name
    FROM users u
    LEFT JOIN batches b ON b.id = u.batch_id
    WHERE u.role = 'student'
    ORDER BY u.name
  `);
  return result.rows.map((row) => ({ ...row, access: computeAccess(row) }));
}

module.exports = {
  TRIAL_DAYS,
  MONTHLY_PRICE,
  ensureSchema,
  computeAccess,
  getAccessForUser,
  requireAccess,
  subscribeMonthly,
  grantFree,
  revokeGrant,
  listStudents
};
