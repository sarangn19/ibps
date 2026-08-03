const pool = require('../database/db');

async function ensureSchema() {
  // Widen the users.role CHECK constraint to allow 'superadmin'. Supabase
  // auto-names inline CHECK constraints, so discover the actual name.
  const client = await pool.connect();
  try {
    const constraint = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
    `);
    if (constraint.rows.length > 0) {
      const name = constraint.rows[0].conname;
      await client.query(`ALTER TABLE users DROP CONSTRAINT ${name}`);
      await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'superadmin'))`);
    }
    // Bootstrap: if no superadmin exists, promote the first admin so the system
    // always has an owner to manage admins.
    const superadminCount = await client.query(`SELECT COUNT(*) FROM users WHERE role = 'superadmin'`);
    if (Number(superadminCount.rows[0].count) === 0) {
      await client.query(
        `UPDATE users SET role = 'superadmin' WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at, id LIMIT 1)`
      );
    }
  } finally {
    client.release();
  }
}

async function listAdmins() {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, name, email, role, created_at,
            (SELECT COUNT(*) FROM attempts WHERE user_id = users.id) AS total_attempts
     FROM users
     WHERE role IN ('admin', 'superadmin')
     ORDER BY role, name`
  );
  return result.rows;
}

async function createAdmin({ name, email, password }) {
  await ensureSchema();
  const bcrypt = require('bcryptjs');

  const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.rows.length > 0) throw Object.assign(new Error('Email already registered'), { status: 400 });

  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, name, email, role, created_at',
    [name, email, password_hash, 'admin']
  );
  return result.rows[0];
}

async function removeAdmin(id) {
  await ensureSchema();
  const result = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
  if (result.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });
  const user = result.rows[0];
  if (user.role === 'superadmin') throw Object.assign(new Error('Superadmins cannot be removed'), { status: 400 });

  await pool.query('UPDATE users SET role = ? WHERE id = ?', ['student', id]);
  return { id: Number(id), new_role: 'student' };
}

module.exports = { ensureSchema, listAdmins, createAdmin, removeAdmin };
