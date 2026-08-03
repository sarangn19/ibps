const pool = require('../database/db');

const toLocal = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) => (d ? d.toISOString().slice(0, 10) : null);

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const fmtMin = (m) => (m > 0 ? Math.round(m) : 0);

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

async function getStudents() {
  const users = await pool.query(`
    SELECT u.id, u.name, u.email, u.created_at, u.exam_goal, u.target_year, u.prep_level,
      u.onboarding_completed, u.subscription_status, u.subscription_plan, u.referred_by
    FROM users u WHERE u.role = 'student' ORDER BY u.id
  `);
  const agg = await pool.query(`
    SELECT a.user_id,
      COUNT(DISTINCT a.id)::int AS sessions,
      COUNT(DISTINCT a.started_at::date) AS active_days,
      COUNT(qr.id) FILTER (WHERE qr.selected_option IS NOT NULL)::int AS questions_solved,
      COUNT(qr.id) FILTER (WHERE qr.selected_option IS NOT NULL AND qr.is_correct = 1)::int AS correct,
      COALESCE(SUM(qr.time_spent_seconds), 0)::int AS study_seconds,
      COALESCE(AVG(qr.time_spent_seconds) FILTER (WHERE qr.selected_option IS NOT NULL), 0)::numeric AS avg_speed,
      MAX(a.started_at) AS last_started,
      MAX(a.submitted_at) AS last_submitted
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN question_responses qr ON qr.attempt_id = a.id
    WHERE u.role = 'student'
    GROUP BY a.user_id
  `);
  const logs = await pool.query(`
    SELECT l.user_id, COUNT(*)::int AS n, MAX(l.timestamp) AS last_log
    FROM activity_logs l
    JOIN users u ON u.id = l.user_id
    WHERE u.role = 'student'
    GROUP BY l.user_id
  `);
  const subj = await pool.query(`
    SELECT a.user_id, q.subject,
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN questions q ON q.id = qr.question_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL
    GROUP BY a.user_id, q.subject
  `);
  const mock = await pool.query(`
    SELECT DISTINCT ON (a.user_id) a.user_id, a.total_score, a.submitted_at
    FROM attempts a
    JOIN tests t ON t.id = a.test_id
    JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND t.type = 'full_mock' AND a.total_score IS NOT NULL
    ORDER BY a.user_id, a.submitted_at DESC
  `);
  const active = await getActiveDates();

  const subjectByUser = {};
  for (const r of subj.rows) {
    if (!subjectByUser[r.user_id]) subjectByUser[r.user_id] = [];
    subjectByUser[r.user_id].push({ subject: r.subject, attempted: r.attempted, correct: r.correct });
  }
  const lastMockByUser = {};
  for (const r of mock.rows) lastMockByUser[r.user_id] = r.total_score;
  const lastLogByUser = {};
  for (const r of logs.rows) lastLogByUser[r.user_id] = r.last_log;

  const aggByUser = {};
  for (const r of agg.rows) aggByUser[r.user_id] = r;

  const now = new Date();
  const list = [];
  for (const u of users.rows) {
    const a = aggByUser[u.id] || {};
    const dates = active[u.id] || new Set();
    const streak = maxStreak(dates);
    const attempted = a.questions_solved || 0;
    const accuracy = attempted > 0 ? Math.round(((a.correct || 0) / attempted) * 100) : 0;
    const subs = subjectByUser[u.id] || [];
    const strong = [...subs].sort((x, y) => y.correct - x.correct)[0];
    const weak = subs.filter((s) => s.attempted >= 3).sort((x, y) => x.correct - y.correct)[0];

    const lastActive = a.last_submitted || a.last_started || lastLogByUser[u.id];
    let inactiveDays = null;
    if (lastActive) {
      const t = toLocal(lastActive);
      if (t) inactiveDays = Math.floor((now - t) / 86400000);
    }
    const isPremium = u.subscription_plan === 'monthly' && u.subscription_status === 'active';
    const activeDays = a.active_days || dates.size || 0;

    let risk = 'green';
    let riskLabel = 'Excellent';
    if (inactiveDays !== null && inactiveDays >= 7) {
      risk = 'red';
      riskLabel = 'At Risk';
    } else if (activeDays <= 1 && inactiveDays !== null && inactiveDays >= 3) {
      risk = 'red';
      riskLabel = 'At Risk';
    } else if (inactiveDays === null) {
      risk = 'red';
      riskLabel = 'Never Active';
    } else if (streak <= 1 || accuracy < 60) {
      risk = 'yellow';
      riskLabel = 'Needs Attention';
    }
    if (isPremium && risk !== 'red') {
      risk = 'green';
      riskLabel = 'Excellent';
    }

    list.push({
      id: u.id,
      name: u.name || 'Student ' + u.id,
      email: u.email,
      joined: u.created_at,
      exam_goal: u.exam_goal,
      target_year: u.target_year,
      prep_level: u.prep_level,
      onboarding_completed: !!u.onboarding_completed,
      is_premium: isPremium,
      subscription_plan: u.subscription_plan,
      subscription_status: u.subscription_status,
      referred_by: u.referred_by,
      active_days: activeDays,
      sessions: a.sessions || 0,
      study_minutes: fmtMin((a.study_seconds || 0) / 60),
      questions_solved: attempted,
      accuracy,
      avg_speed: a.avg_speed ? Math.round(Number(a.avg_speed)) : 0,
      strong_subject: strong ? strong.subject : null,
      weak_subject: weak ? weak.subject : null,
      latest_mock_score: lastMockByUser[u.id] != null ? Math.round(lastMockByUser[u.id]) : null,
      streak,
      inactive_days: inactiveDays,
      risk,
      risk_label: riskLabel,
    });
  }
  return list;
}

async function getStudentDetail(id) {
  const u = await pool.query(`
    SELECT u.id, u.name, u.email, u.created_at, u.exam_goal, u.target_year, u.prep_level,
      u.daily_study_minutes, u.onboarding_completed, u.subscription_status, u.subscription_plan,
      u.subscription_ends_at, u.referral_code, u.referred_by
    FROM users u WHERE u.role = 'student' AND u.id = $1
  `, [id]);
  if (u.rows.length === 0) return null;

  const agg = await pool.query(`
    SELECT a.user_id,
      COUNT(DISTINCT a.id)::int AS sessions,
      COUNT(DISTINCT a.started_at::date) AS active_days,
      COUNT(qr.id) FILTER (WHERE qr.selected_option IS NOT NULL)::int AS questions_solved,
      COUNT(qr.id) FILTER (WHERE qr.selected_option IS NOT NULL AND qr.is_correct = 1)::int AS correct,
      COALESCE(SUM(qr.time_spent_seconds), 0)::int AS study_seconds,
      COALESCE(AVG(qr.time_spent_seconds) FILTER (WHERE qr.selected_option IS NOT NULL), 0)::numeric AS avg_speed,
      MAX(a.started_at) AS last_started,
      MAX(a.submitted_at) AS last_submitted
    FROM attempts a
    LEFT JOIN question_responses qr ON qr.attempt_id = a.id
    WHERE a.user_id = $1
    GROUP BY a.user_id
  `, [id]);
  const subj = await pool.query(`
    SELECT q.subject,
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct,
      COALESCE(AVG(qr.time_spent_seconds), 0)::numeric AS avg_time
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN questions q ON q.id = qr.question_id
    WHERE a.user_id = $1 AND qr.selected_option IS NOT NULL
    GROUP BY q.subject ORDER BY attempted DESC
  `, [id]);
  const topics = await pool.query(`
    SELECT q.subject, q.topic,
      COUNT(*)::int AS attempted,
      SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN questions q ON q.id = qr.question_id
    WHERE a.user_id = $1 AND qr.selected_option IS NOT NULL
    GROUP BY q.subject, q.topic ORDER BY attempted DESC
  `, [id]);
  const mastery = await pool.query(`
    SELECT subject, topic, mastery_score, classification, current_streak, last_attempt_at
    FROM student_topic_mastery WHERE user_id = $1 ORDER BY mastery_score DESC
  `, [id]);
  const mocks = await pool.query(`
    SELECT a.id, t.title, a.started_at, a.submitted_at, a.total_score, a.status
    FROM attempts a JOIN tests t ON t.id = a.test_id
    WHERE a.user_id = $1 AND t.type = 'full_mock'
    ORDER BY a.started_at DESC
  `, [id]);
  const logs = await pool.query(`
    SELECT event_type, timestamp, metadata FROM activity_logs
    WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 200
  `, [id]);
  const attempts = await pool.query(`
    SELECT a.id, t.title, t.type, a.status, a.started_at, a.submitted_at, a.total_score
    FROM attempts a JOIN tests t ON t.id = a.test_id
    WHERE a.user_id = $1 ORDER BY a.started_at DESC
  `, [id]);
  const responses = await pool.query(`
    SELECT q.subject, q.topic, qr.is_correct, qr.selected_option, qr.time_spent_seconds, qr.created_at
    FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id
    JOIN questions q ON q.id = qr.question_id
    WHERE a.user_id = $1 ORDER BY qr.created_at DESC
  `, [id]);

  const active = await getActiveDates();
  const dates = active[id] || new Set();
  const streak = maxStreak(dates);

  const a = agg.rows[0] || {};
  const attempted = a.questions_solved || 0;
  const accuracy = attempted > 0 ? Math.round(((a.correct || 0) / attempted) * 100) : 0;
  const strongSubj = [...subj.rows].sort((x, y) => y.correct - x.correct)[0];
  const weakSubj = subj.rows.filter((s) => s.attempted >= 3).sort((x, y) => x.correct - y.correct)[0];
  const strongTopics = [...topics.rows].sort((x, y) => y.correct - x.correct).slice(0, 3);
  const weakTopics = topics.rows.filter((t) => t.attempted >= 2).sort((x, y) => x.correct - y.correct).slice(0, 3);

  const mockScores = mocks.rows
    .filter((m) => m.total_score != null)
    .map((m) => ({ title: m.title, score: Math.round(m.total_score), started_at: m.started_at }));

  const timeline = [];
  for (const r of logs.rows) {
    timeline.push({ time: r.timestamp, type: r.event_type, detail: r.metadata || '' });
  }
  for (const r of attempts.rows) {
    if (r.started_at) {
      timeline.push({ time: r.started_at, type: 'attempt_started', detail: `${r.title} (${r.type})` });
    }
    if (r.submitted_at) {
      timeline.push({
        time: r.submitted_at,
        type: r.status === 'completed' ? 'attempt_completed' : 'attempt_abandoned',
        detail: `${r.title}${r.total_score != null ? ' - ' + Math.round(r.total_score) + ' score' : ''}`,
      });
    }
  }
  for (const r of responses.rows) {
    if (!r.created_at) continue;
    timeline.push({
      time: r.created_at,
      type: r.selected_option ? (r.is_correct === 1 ? 'question_correct' : 'question_wrong') : 'question_skipped',
      detail: `${r.subject} - ${r.topic}${r.time_spent_seconds ? ' (' + Math.round(r.time_spent_seconds) + 's)' : ''}`,
    });
  }
  timeline.sort((x, y) => {
    const a = toLocal(x.time);
    const b = toLocal(y.time);
    if (!a || !b) return 0;
    return b - a;
  });
  const recent = timeline.slice(0, 100);

  const user = u.rows[0];
  const lastActive = a.last_submitted || a.last_started;
  let inactiveDays = null;
  if (lastActive) {
    const t = toLocal(lastActive);
    if (t) inactiveDays = Math.floor((new Date() - t) / 86400000);
  }
  const isPremium = user.subscription_plan === 'monthly' && user.subscription_status === 'active';

  return {
    profile: {
      id: user.id,
      name: user.name || 'Student ' + user.id,
      email: user.email,
      joined: user.created_at,
      exam_goal: user.exam_goal,
      target_year: user.target_year,
      prep_level: user.prep_level,
      daily_study_minutes: user.daily_study_minutes,
      onboarding_completed: !!user.onboarding_completed,
      is_premium: isPremium,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
      subscription_ends_at: user.subscription_ends_at,
      referral_code: user.referral_code,
      referred_by: user.referred_by,
      inactive_days: inactiveDays,
    },
    learning: {
      questions_solved: attempted,
      accuracy,
      study_minutes: fmtMin((a.study_seconds || 0) / 60),
      avg_speed: a.avg_speed ? Math.round(Number(a.avg_speed)) : 0,
      sessions: a.sessions || 0,
      active_days: dates.size,
      streak,
      strong_subject: strongSubj ? strongSubj.subject : null,
      weak_subject: weakSubj ? weakSubj.subject : null,
      strong_topics: strongTopics.map((t) => ({ subject: t.subject, topic: t.topic, accuracy: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0 })),
      weak_topics: weakTopics.map((t) => ({ subject: t.subject, topic: t.topic, accuracy: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0 })),
    },
    subjects: subj.rows.map((s) => ({
      subject: s.subject,
      attempted: s.attempted,
      accuracy: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
      avg_time: Math.round(Number(s.avg_time) || 0),
    })),
    mastery: mastery.rows.map((m) => ({
      subject: m.subject,
      topic: m.topic,
      score: Math.round(m.mastery_score),
      classification: m.classification,
      streak: m.current_streak,
    })),
    mock_scores: mockScores,
    timeline: recent,
  };
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
  getStudents,
  getStudentDetail,
  pct,
  maxStreak,
  dayKey,
};
