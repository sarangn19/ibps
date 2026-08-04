const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { ensureSchema: ensureSuperadminSchema } = require('../services/superadminService');
const { getAccessForUser } = require('../services/subscriptionService');
const { ensureSchema: ensureReferralSchema, nextUniqueCode, resolveReferrer } = require('../services/referralService');

// Self-migrating: adds the password_resets table used by the no-email
// forgot-password flow (code shown to the user in-app instead of emailed).
async function ensurePasswordResetSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)`);
  } finally {
    client.release();
  }
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

const register = async (req, res) => {
  try {
    const { name, email, password, batch_id, referral_code } = req.body;
    // Role is always 'student' on public registration; admin/superadmin are
    // created only by superadmins via the superadmin endpoints.
    const role = 'student';

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await ensureReferralSchema();
    const newCode = await nextUniqueCode();
    const referrerId = await resolveReferrer(referral_code);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, batch_id, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, name, email, role, batch_id, exam_goal, target_year, prep_level, daily_study_minutes, onboarding_completed, referral_code, referred_by',
      [name, email, password_hash, role, batch_id, newCode, referrerId]
    );

    const user = result.rows[0];
    if (user.onboarding_completed === null || user.onboarding_completed === undefined) user.onboarding_completed = false;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const access = await getAccessForUser(user.id);

    res.status(201).json({ user, token, access });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Run the superadmin role migration/bootstrap on login so the first admin
    // is promoted deterministically (boot-time migration can race on cold start).
    try { await ensureSuperadminSchema(); } catch (e) { console.error('ensureSuperadminSchema in login failed:', e); }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, event_type, metadata) VALUES (?, ?, ?)',
      [user.id, 'login', JSON.stringify({ timestamp: new Date().toISOString() })]
    );

    const access = await getAccessForUser(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        batch_id: user.batch_id,
        exam_goal: user.exam_goal,
        target_year: user.target_year,
        prep_level: user.prep_level,
        daily_study_minutes: user.daily_study_minutes,
        referral_code: user.referral_code,
        referred_by: user.referred_by,
        onboarding_completed: user.onboarding_completed === true || user.onboarding_completed === 'true' || user.onboarding_completed === 1
      },
      token,
      access
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, batch_id, created_at, exam_goal, target_year, prep_level, daily_study_minutes, onboarding_completed, referral_code, referred_by FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    user.onboarding_completed = user.onboarding_completed === true || user.onboarding_completed === 'true' || user.onboarding_completed === 1;
    const access = await getAccessForUser(req.user.id);
    res.json({ user, access });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

const saveOnboarding = async (req, res) => {
  try {
    const { exam_goal, target_year, prep_level, daily_study_minutes } = req.body;

    if (!exam_goal) {
      return res.status(400).json({ error: 'exam_goal is required' });
    }
    if (!target_year) {
      return res.status(400).json({ error: 'target_year is required' });
    }
    if (!['beginner', 'intermediate', 'advanced'].includes(prep_level)) {
      return res.status(400).json({ error: 'prep_level must be beginner, intermediate or advanced' });
    }
    const minutes = parseInt(daily_study_minutes, 10);
    if (!minutes || minutes < 15 || minutes > 600) {
      return res.status(400).json({ error: 'daily_study_minutes must be between 15 and 600' });
    }

    const result = await pool.query(
      `UPDATE users SET exam_goal = ?, target_year = ?, prep_level = ?, daily_study_minutes = ?, onboarding_completed = true
       WHERE id = ? RETURNING id, name, email, role, batch_id, exam_goal, target_year, prep_level, daily_study_minutes, onboarding_completed`,
      [exam_goal, target_year, prep_level, minutes, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    user.onboarding_completed = user.onboarding_completed === true || user.onboarding_completed === 'true' || user.onboarding_completed === 1;
    res.json(user);
  } catch (error) {
    console.error('Save onboarding error:', error);
    res.status(500).json({ error: 'Failed to save onboarding' });
  }
};

const getStudyPlan = async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT exam_goal, target_year, prep_level, daily_study_minutes, onboarding_completed FROM users WHERE id = ?',
      [req.user.id]
    );
    const profile = userResult.rows[0];
    if (!profile || !(profile.onboarding_completed === true || profile.onboarding_completed === 'true' || profile.onboarding_completed === 1)) {
      return res.status(400).json({ error: 'Onboarding not completed yet' });
    }

    const level = profile.prep_level;
    const minutes = profile.daily_study_minutes;

    const mastery = await pool.query(
      'SELECT subject, topic, subtopic, classification, mastery_score, attempt_count, accuracy_rolling FROM student_topic_mastery WHERE user_id = ? ORDER BY mastery_score ASC',
      [req.user.id]
    );

    const weak = mastery.rows.filter(r => ['weak', 'developing'].includes(r.classification));
    const attempted = mastery.rows.filter(r => r.attempt_count > 0);
    const avgAccuracy = attempted.length
      ? attempted.reduce((s, r) => s + (r.accuracy_rolling || 0), 0) / attempted.length
      : null;

    const topicsBySubject = {};
    for (const r of weak) {
      if (!topicsBySubject[r.subject]) topicsBySubject[r.subject] = [];
      if (!topicsBySubject[r.subject].includes(r.topic)) topicsBySubject[r.subject].push(r.topic);
    }

    const questionsPerDay = Math.round(minutes / 1.5);
    const plan = [];
    const subjects = Object.keys(topicsBySubject).length
      ? Object.entries(topicsBySubject)
      : [['Quantitative Aptitude', []], ['Reasoning Ability', []], ['English Language', []], ['General Awareness', []]];

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const starterBySubject = {
      'Quantitative Aptitude': ['Percentage', 'Simplification'],
      'Reasoning Ability': ['Inequalities', 'Blood Relations'],
      'English Language': ['Vocabulary', 'Grammar'],
      'General Awareness': ['Banking Awareness', 'Static GK']
    };
    for (let d = 0; d < 7; d++) {
      const [subject, topics] = subjects[d % subjects.length];
      const starters = starterBySubject[subject] || ['Percentage', 'Simplification'];
      const planTopics = topics.length
        ? topics.slice(0, 2)
        : starters.slice(0, 2);
      plan.push({
        day: d + 1,
        day_name: dayNames[d],
        focus_subject: subject,
        topics: planTopics,
        questions_to_practice: questionsPerDay,
        activity: level === 'beginner'
          ? `Learn the concept then practice ${questionsPerDay} questions from ${planTopics.join(', ')}`
          : `Practice ${questionsPerDay} questions from ${planTopics.join(', ')} and review explanations`,
        notes: weak.length === 0 ? 'Start with foundational practice across subjects.' : 'Targets your current weak areas.'
      });
    }

    res.json({
      exam_goal: profile.exam_goal,
      target_year: profile.target_year,
      prep_level: level,
      daily_study_minutes: minutes,
      questions_per_day: questionsPerDay,
      avg_accuracy: avgAccuracy !== null ? Math.round(avgAccuracy) : null,
      weak_topic_count: weak.length,
      weekly_plan: plan
    });
  } catch (error) {
    console.error('Get study plan error:', error);
    res.status(500).json({ error: 'Failed to generate study plan' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await ensurePasswordResetSchema();

    const userResult = await pool.query('SELECT id FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email' });
    }
    const userId = userResult.rows[0].id;

    // Single-use 6-digit code, valid for 15 minutes.
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    await pool.query(
      `INSERT INTO password_resets (user_id, code_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, hashResetCode(code), expiresAt]
    );

    // Since there's no email service, return the code directly so it can be
    // shown to the user (only valid for 15 minutes, single-use).
    res.json({ success: true, reset_code: code, expires_in_minutes: 15 });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to start password reset' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, reset_code, new_password } = req.body;
    if (!email || !reset_code || !new_password) {
      return res.status(400).json({ error: 'Email, reset code and new password are required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    await ensurePasswordResetSchema();

    const userResult = await pool.query('SELECT id FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email' });
    }
    const userId = userResult.rows[0].id;

    const codeHash = hashResetCode(reset_code);
    const resetResult = await pool.query(
      `SELECT id, expires_at, used FROM password_resets
       WHERE user_id = ? AND code_hash = ? AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [userId, codeHash]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already-used reset code' });
    }

    const reset = resetResult.rows[0];
    const expiresAt = new Date(String(reset.expires_at).replace(' ', 'T') + 'Z');
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset code has expired. Request a new one.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [passwordHash, userId]
    );
    await pool.query(`UPDATE password_resets SET used = true WHERE id = ?`, [reset.id]);

    res.json({ success: true, message: 'Password updated. You can log in now.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = { register, login, getMe, saveOnboarding, getStudyPlan, forgotPassword, resetPassword, ensurePasswordResetSchema };
