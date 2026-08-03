const pool = require('../database/db');

const toLocal = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) => (d ? d.toISOString().slice(0, 10) : null);

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

async function getOverall() {
  const r = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student')::int AS students,
      (SELECT COUNT(*) FROM question_responses qr JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id WHERE u.role = 'student')::int AS total_responses,
      (SELECT COUNT(*) FROM question_responses qr JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND qr.selected_option IS NOT NULL)::int AS attempted_responses,
      (SELECT COUNT(*) FROM question_responses qr JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND qr.is_correct = 1)::int AS correct_responses,
      (SELECT COUNT(DISTINCT DATE(ts)) FROM (
        SELECT started_at AS ts FROM attempts a JOIN users u ON u.id = a.user_id WHERE u.role = 'student'
        UNION ALL
        SELECT timestamp AS ts FROM activity_logs l JOIN users u ON u.id = l.user_id WHERE u.role = 'student'
      ) x)::int AS active_days,
      (SELECT COUNT(DISTINCT user_id) FROM attempts a JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND started_at >= to_char(now() - interval '24 hours', 'YYYY-MM-DD HH24:MI:SS'))::int AS dau,
      (SELECT COUNT(DISTINCT user_id) FROM attempts a JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND started_at >= to_char(now() - interval '7 days', 'YYYY-MM-DD HH24:MI:SS'))::int AS wau,
      (SELECT COUNT(*) FROM attempts a JOIN tests t ON t.id = a.test_id JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND t.type = 'full_mock' AND a.status = 'completed')::int AS mocks_completed,
      (SELECT COUNT(*) FROM attempts a JOIN tests t ON t.id = a.test_id JOIN users u ON u.id = a.user_id WHERE u.role = 'student' AND t.type = 'full_mock')::int AS mocks_total,
      (SELECT COUNT(*) FROM users WHERE role = 'student' AND subscription_plan = 'monthly' AND subscription_status = 'active')::int AS premium_students
  `);
  const o = r.rows[0] || {};
  return {
    students: o.students || 0,
    total_responses: o.total_responses || 0,
    attempted_responses: o.attempted_responses || 0,
    correct_responses: o.correct_responses || 0,
    active_days: o.active_days || 0,
    dau: o.dau || 0,
    wau: o.wau || 0,
    mocks_completed: o.mocks_completed || 0,
    mocks_total: o.mocks_total || 0,
    premium_students: o.premium_students || 0,
  };
}

async function getAccuracy() {
  const r = await pool.query(`
    SELECT
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct,
      COUNT(*)::int AS attempted
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL
  `);
  const row = r.rows[0] || {};
  const correct = row.correct || 0;
  const attempted = row.attempted || 0;
  return { correct, attempted, accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0 };
}

async function getStudyTime() {
  const r = await pool.query(`
    SELECT COALESCE(SUM(qr.time_spent_seconds), 0)::int AS seconds
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.time_spent_seconds IS NOT NULL
  `);
  return (r.rows[0] || {}).seconds || 0;
}

async function getSubjectAccuracy() {
  const r = await pool.query(`
    SELECT q.subject,
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct
    FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL
    GROUP BY q.subject
    ORDER BY attempted DESC
  `);
  return r.rows.map((x) => ({
    subject: x.subject,
    attempted: x.attempted,
    correct: x.correct,
    accuracy: x.attempted > 0 ? Math.round((x.correct / x.attempted) * 100) : 0,
  }));
}

async function getTopicStats() {
  const r = await pool.query(`
    SELECT q.subject, q.topic,
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct,
      COALESCE(AVG(qr.time_spent_seconds), 0)::numeric AS avg_time
    FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL
    GROUP BY q.subject, q.topic
    ORDER BY attempted DESC
  `);
  return r.rows.map((x) => ({
    subject: x.subject,
    topic: x.topic,
    attempted: x.attempted,
    correct: x.correct,
    accuracy: x.attempted > 0 ? Math.round((x.correct / x.attempted) * 100) : 0,
    avg_time: Number(x.avg_time) || 0,
  }));
}

async function getSessionTimes() {
  const r = await pool.query(`
    SELECT a.id, a.user_id, a.started_at, a.submitted_at
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND a.status = 'completed' AND a.started_at IS NOT NULL AND a.submitted_at IS NOT NULL
  `);
  const times = [];
  for (const row of r.rows) {
    const s = toLocal(row.started_at);
    const e = toLocal(row.submitted_at);
    if (s && e && e > s) {
      times.push({ user_id: row.user_id, minutes: (e - s) / 60000, started_at: s });
    }
  }
  return times;
}

async function getActiveDates() {
  const r = await pool.query(`
    SELECT a.user_id, a.started_at AS ts FROM attempts a JOIN users u ON u.id = a.user_id WHERE u.role = 'student'
    UNION
    SELECT l.user_id, l.timestamp AS ts FROM activity_logs l JOIN users u ON u.id = l.user_id WHERE u.role = 'student'
  `);
  const perUser = {};
  for (const row of r.rows) {
    const d = dayKey(toLocal(row.ts));
    if (!d) continue;
    if (!perUser[row.user_id]) perUser[row.user_id] = new Set();
    perUser[row.user_id].add(d);
  }
  return perUser;
}

function maxStreak(dates) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curd = new Date(sorted[i]);
    const diff = Math.round((curd - prev) / 86400000);
    if (diff === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else if (diff > 1) {
      cur = 1;
    }
  }
  return best;
}

async function getErrorTags() {
  const r = await pool.query(`
    SELECT qr.error_tag, COUNT(*)::int AS n
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL AND qr.is_correct = 0 AND qr.error_tag IS NOT NULL
    GROUP BY qr.error_tag
    ORDER BY n DESC
  `);
  return r.rows;
}

async function getMockDetails() {
  const r = await pool.query(`
    SELECT a.id AS attempt_id, a.user_id, a.started_at, a.submitted_at, a.total_score,
      t.title AS test_title, t.type AS test_type, t.question_ids
    FROM attempts a
    JOIN tests t ON t.id = a.test_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND t.type = 'full_mock'
  `);
  const mocks = [];
  for (const row of r.rows) {
    let ids = [];
    try {
      const q = JSON.parse(row.question_ids);
      ids = Array.isArray(q) ? q : q.ids || [];
    } catch (e) {
      ids = String(row.question_ids || '').replace(/[{}]/g, '').split(',').map((x) => Number(x)).filter(Boolean);
    }
    mocks.push({
      attempt_id: row.attempt_id,
      user_id: row.user_id,
      test_title: row.test_title,
      total_score: row.total_score,
      started_at: toLocal(row.started_at),
      submitted_at: toLocal(row.submitted_at),
      question_ids: ids,
    });
  }
  return mocks;
}

async function getResponseTimesPerTopic() {
  const r = await pool.query(`
    SELECT q.topic, qr.time_spent_seconds
    FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.time_spent_seconds IS NOT NULL
  `);
  return r.rows;
}

module.exports = {
  getOverall,
  getAccuracy,
  getStudyTime,
  getSubjectAccuracy,
  getTopicStats,
  getSessionTimes,
  getActiveDates,
  getErrorTags,
  getMockDetails,
  getResponseTimesPerTopic,
  pct,
  maxStreak,
  dayKey,
};
