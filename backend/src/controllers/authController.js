const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { ensureSchema: ensureSuperadminSchema } = require('../services/superadminService');
const { getAccessForUser } = require('../services/subscriptionService');
const { ensureSchema: ensureReferralSchema, nextUniqueCode, resolveReferrer } = require('../services/referralService');

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

module.exports = { register, login, getMe, saveOnboarding, getStudyPlan };
