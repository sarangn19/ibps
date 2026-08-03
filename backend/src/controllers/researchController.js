const pool = require('../database/db');
const rs = require('../services/researchService');
const { dayKey } = rs;

const todayStr = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const fmtMin = (m) => (m > 0 ? Math.round(m) : 0);

async function getJourney() {
  const overall = await rs.getOverall();
  const onb = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE role = 'student' AND onboarding_completed = true`);
  const firstQ = await pool.query(`
    SELECT COUNT(DISTINCT a.user_id)::int n FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL`);
  const firstQuiz = await pool.query(`
    SELECT COUNT(DISTINCT a.user_id)::int n FROM attempts a JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND a.status IN ('completed', 'in_progress')`);
  const firstMock = await pool.query(`
    SELECT COUNT(DISTINCT a.user_id)::int n FROM attempts a
    JOIN tests t ON t.id = a.test_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND t.type = 'full_mock'`);
  const returned = await pool.query(`
    SELECT COUNT(*)::int n FROM (
      SELECT a.user_id FROM attempts a JOIN users u ON u.id = a.user_id
      WHERE u.role = 'student' GROUP BY a.user_id HAVING COUNT(DISTINCT a.started_at::date) >= 2
    ) x`);
  const premium = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE role = 'student' AND subscription_plan = 'monthly' AND subscription_status = 'active'`);

  const steps = [
    { key: 'signup', label: 'Registered', users: overall.students, conversion: 100 },
    { key: 'onboarding', label: 'Completed Onboarding', users: onb.rows[0].n },
    { key: 'first_question', label: 'Solved First Question', users: firstQ.rows[0].n },
    { key: 'first_quiz', label: 'Attempted a Test', users: firstQuiz.rows[0].n },
    { key: 'first_mock', label: 'Attempted a Mock', users: firstMock.rows[0].n },
    { key: 'returned', label: 'Returned on 2+ days', users: returned.rows[0].n },
    { key: 'premium', label: 'Subscribed', users: premium.rows[0].n },
  ];
  for (const s of steps) s.conversion = rs.pct(s.users, overall.students);
  return steps;
}

async function getLearningAnalytics() {
  const overall = await rs.getOverall();
  const acc = await rs.getAccuracy();
  const studySec = await rs.getStudyTime();
  const subjects = await rs.getSubjectAccuracy();
  const active = await rs.getActiveDates();
  const userIds = Object.keys(active).map(Number);
  const streaks = userIds.map((id) => rs.maxStreak(active[id]));
  const avgStreak = streaks.length ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0;
  const today = todayStr();
  const todayRes = await pool.query(`
    SELECT COUNT(*)::int n FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.created_at LIKE $1 || '%'`, [`${today} `]);
  const todayCount = todayRes.rows[0].n;
  const todaySec = await pool.query(`
    SELECT COALESCE(SUM(qr.time_spent_seconds),0)::int n FROM question_responses qr
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.created_at LIKE $1 || '%'`, [`${today} `]);

  const strong = [...subjects].sort((a, b) => b.accuracy - a.accuracy)[0];
  const weak = [...subjects].filter((s) => s.attempted >= 3).sort((a, b) => a.accuracy - b.accuracy)[0];
  const predicted = Math.round(Math.max(0, Math.min(100, acc.accuracy)));

  return {
    questions_solved_today: todayCount,
    avg_accuracy: acc.accuracy,
    avg_study_minutes: fmtMin(studySec / Math.max(1, overall.active_days)),
    study_minutes_today: fmtMin(todaySec.rows[0].n / 60),
    strong_subject: strong ? { name: strong.subject, accuracy: strong.accuracy, attempted: strong.attempted } : null,
    weak_subject: weak ? { name: weak.subject, accuracy: weak.accuracy, attempted: weak.attempted } : null,
    predicted_score: predicted,
    avg_consistency_days: avgStreak,
    questions_per_active_day: overall.active_days > 0 ? Math.round(overall.attempted_responses / overall.active_days) : 0,
  };
}

async function getMockAnalytics() {
  const overall = await rs.getOverall();
  const sessions = await rs.getSessionTimes();
  const mockSessions = sessions.filter((s) => true);
  const mocks = await rs.getMockDetails();
  const topicStats = await rs.getTopicStats();
  const respTimes = await rs.getResponseTimesPerTopic();

  const timeByTopic = {};
  for (const r of respTimes) {
    if (!timeByTopic[r.topic]) timeByTopic[r.topic] = [];
    timeByTopic[r.topic].push(r.time_spent_seconds);
  }
  const topicAvg = Object.entries(timeByTopic).map(([topic, arr]) => ({
    topic,
    avg_time: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    count: arr.length,
  })).filter((t) => t.count >= 2);

  const avgSession = mockSessions.length ? mockSessions.reduce((a, b) => a + b.minutes, 0) / mockSessions.length : 0;
  const scores = mocks.filter((m) => m.total_score !== null).map((m) => m.total_score);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const skippedBySubject = await pool.query(`
    SELECT q.subject, COUNT(*)::int n FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NULL
    GROUP BY q.subject ORDER BY n DESC`);
  const highestWrong = await pool.query(`
    SELECT q.topic, COUNT(*)::int n FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL AND qr.is_correct = 0
    GROUP BY q.topic ORDER BY n DESC LIMIT 3`);

  return {
    mocks_completed_pct: rs.pct(overall.mocks_completed, overall.mocks_total),
    avg_minutes: fmtMin(avgSession),
    avg_score: avgScore > 0 ? Math.round(avgScore * 100) / 100 : 0,
    most_skipped_subject: skippedBySubject.rows[0] ? skippedBySubject.rows[0].subject : null,
    highest_wrong_topics: highestWrong.rows,
    slowest_topics: topicAvg.slice().sort((a, b) => b.avg_time - a.avg_time).slice(0, 3),
    fastest_topics: topicAvg.slice().sort((a, b) => a.avg_time - b.avg_time).slice(0, 3),
    topic_stats: topicStats,
  };
}

async function getTopicHeatmap() {
  const subjects = await rs.getSubjectAccuracy();
  return subjects.map((s) => ({ subject: s.subject, accuracy: s.accuracy, attempted: s.attempted }));
}

async function getDropoffs() {
  const mocks = await rs.getMockDetails();
  const overall = await rs.getOverall();
  const byId = {};
  for (const m of mocks) {
    if (!byId[m.attempt_id]) byId[m.attempt_id] = { attempt_id: m.attempt_id, ids: new Set(m.question_ids) };
  }
  const responses = await pool.query(`
    SELECT qr.attempt_id, q.subject, COUNT(*)::int n
    FROM question_responses qr
    JOIN questions q ON q.id = qr.question_id
    JOIN attempts a ON a.id = qr.attempt_id JOIN users u ON u.id = a.user_id
    WHERE u.role = 'student' AND qr.selected_option IS NOT NULL
    GROUP BY qr.attempt_id, q.subject`);
  const subjectSeen = {};
  for (const r of responses.rows) {
    if (!subjectSeen[r.attempt_id]) subjectSeen[r.attempt_id] = {};
    subjectSeen[r.attempt_id][r.subject] = r.n;
  }
  // Build funnel: total students who started a mock, then per-subject reach
  const subjectsOrder = [];
  for (const m of mocks) {
    for (const s of Object.keys(subjectSeen[m.attempt_id] || {})) {
      if (!subjectsOrder.includes(s)) subjectsOrder.push(s);
    }
  }
  const reach = [];
  let prevUsers = new Set();
  for (const s of subjectsOrder) {
    const users = new Set();
    for (const m of mocks) if ((subjectSeen[m.attempt_id] || {})[s]) users.add(m.user_id);
    const all = new Set([...prevUsers, ...users]);
    reach.push({ subject: s, users: all.size });
    prevUsers = all;
  }
  return {
    started_mock_users: mocks.length ? new Set(mocks.map((m) => m.user_id)).size : 0,
    total_mock_attempts: mocks.length,
    by_subject: reach,
    biggest_drop_subject: reach.length ? reach.sort((a, b) => a.users - b.users)[0].subject : null,
  };
}

async function getRetention() {
  const overall = await rs.getOverall();
  const sessions = await rs.getSessionTimes();
  const mockDetails = await rs.getMockDetails();
  const active = await rs.getActiveDates();

  const premiumSet = new Set((await pool.query(`SELECT id FROM users WHERE role = 'student' AND subscription_plan = 'monthly' AND subscription_status = 'active'`)).rows.map((r) => r.id));

  const dayCounts = { 1: 0, 7: 0, 15: 0, 30: 0 };
  const dayCountsPremium = { 1: 0, 7: 0, 15: 0, 30: 0 };
  const premiumUsers = new Set();

  for (const [uid, dates] of Object.entries(active)) {
    if (dates.size < 1) continue;
    const sorted = [...dates].sort();
    const first = new Date(sorted[0]);
    const isPremium = premiumSet.has(Number(uid));
    if (isPremium) premiumUsers.add(Number(uid));
    for (const day of Object.keys(dayCounts)) {
      const target = new Date(first);
      target.setUTCDate(target.getUTCDate() + Number(day));
      const targetKey = dayKey(target);
      if (dates.has(targetKey)) {
        dayCounts[day] += 1;
        if (isPremium) dayCountsPremium[day] += 1;
      }
    }
  }

  const base = Object.keys(active).filter((id) => active[id].size >= 1).length || overall.students || 1;
  const basePremium = Math.max(premiumSet.size, 1);

  return {
    day1: rs.pct(dayCounts[1], base),
    day7: rs.pct(dayCounts[7], base),
    day15: rs.pct(dayCounts[15], base),
    day30: rs.pct(dayCounts[30], base),
    premium_day7: rs.pct(dayCountsPremium[7], basePremium),
    free_day7: rs.pct(dayCounts[7] - dayCountsPremium[7], Math.max(base - premiumUsers.size, 1)),
    base,
  };
}

async function getPersonas() {
  const sessions = await rs.getSessionTimes();
  const subjects = await rs.getSubjectAccuracy();
  const active = await rs.getActiveDates();
  const mastery = await pool.query(`
    SELECT user_id, subject, mastery_score FROM student_topic_mastery
    WHERE classification IN ('weak', 'developing', 'strong')`);
  const masteryByUser = {};
  for (const r of mastery.rows) {
    if (!masteryByUser[r.user_id]) masteryByUser[r.user_id] = [];
    masteryByUser[r.user_id].push({ subject: r.subject, score: r.mastery_score });
  }
  const favByUser = {};
  for (const r of mastery.rows) {
    const uid = r.user_id;
    if (!favByUser[uid]) favByUser[uid] = {};
    favByUser[uid][r.subject] = (favByUser[uid][r.subject] || 0) + (r.mastery_score >= 70 ? 1 : 0);
  }
  const userFav = {};
  for (const [uid, m] of Object.entries(favByUser)) {
    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (entries.length) userFav[uid] = entries[0][0];
  }

  const hourlyByUser = {};
  for (const s of sessions) {
    const h = s.started_at.getHours();
    if (!hourlyByUser[s.user_id]) hourlyByUser[s.user_id] = [];
    hourlyByUser[s.user_id].push(h);
  }

  const personas = [];
  for (const [uidStr, dates] of Object.entries(active)) {
    const uid = Number(uidStr);
    const hours = hourlyByUser[uid] || [];
    const sessionsForUser = sessions.filter((s) => s.user_id === uid);
    const fav = userFav[uid] || null;
    const weak = subjects.length ? [...subjects].filter((s) => s.attempted >= 3).sort((a, b) => a.accuracy - b.accuracy)[0] : null;
    const avgSession = sessionsForUser.length ? sessionsForUser.reduce((a, b) => a + b.minutes, 0) / sessionsForUser.length : 0;
    const streak = rs.maxStreak(dates);

    let persona = 'Casual Learner';
    let risk = null;
    if (hours.length && hours.every((h) => h >= 21 || h < 6) && sessionsForUser.length >= 2) {
      persona = 'Night Learner';
    } else if (streak >= 3) {
      persona = 'Consistent Learner';
    }
    if (avgSession >= 60 && streak >= 2) {
      persona = 'Exam-Focused';
      risk = 'likely premium buyer';
    }
    if (streak === 0 && dates.size <= 1) {
      risk = 'at risk of churn';
    }

    personas.push({
      persona,
      user_id: uid,
      avg_session_minutes: fmtMin(avgSession),
      favorite_subject: fav,
      weak_subject: weak ? weak.subject : null,
      study_streak: streak,
      risk,
    });
  }
  return personas;
}

async function getCoach() {
  const overall = await rs.getOverall();
  const acc = await rs.getAccuracy();
  const subjects = await rs.getSubjectAccuracy();
  const topicStats = await rs.getTopicStats();
  const learning = await getLearningAnalytics();
  const mock = await getMockAnalytics();
  const retention = await getRetention();
  const dropoffs = await getDropoffs();

  const lines = [];
  const weak = [...subjects].filter((s) => s.attempted >= 3).sort((a, b) => a.accuracy - b.accuracy)[0];
  const wrong = [...topicStats].filter((t) => t.attempted >= 2).sort((a, b) => a.accuracy - b.accuracy)[0];

  if (overall.dau > 0) {
    lines.push(`${overall.dau} of ${overall.students} students were active in the last 24 hours.`);
  }
  if (weak) {
    lines.push(`${weak.subject} is the weakest section at ${weak.accuracy}% accuracy across ${weak.attempted} attempts.`);
  }
  if (wrong) {
    lines.push(`Top weakness topic: ${wrong.topic} (${wrong.accuracy}% accuracy).`);
  }
  if (mock.mocks_total > 0) {
    const drop = mock.mocks_completed_pct;
    lines.push(`${drop}% of started mock tests are completed.${drop < 60 ? ' Many students may be abandoning mid-test.' : ''}`);
  }
  if (dropoffs.biggest_drop_subject) {
    lines.push(`Mock tests show the biggest drop-off around the ${dropoffs.biggest_drop_subject} section.`);
  }
  lines.push(`7-day retention is ${retention.day7}%.`);
  if (acc.attempted > 0) {
    lines.push(`Overall accuracy is ${acc.accuracy}% across ${acc.attempted} attempted questions.`);
  }

  const recs = [];
  if (weak) recs.push(`Add an easy-mode practice set for ${weak.subject} to build confidence before full mocks.`);
  if (wrong) recs.push(`Improve explanations for ${wrong.topic} questions — this is where students lose the most marks.`);
  if (retention.day7 < 60) recs.push('Introduce daily revision reminders and streaks to improve 7-day retention.');
  if (acc.accuracy < 60) recs.push('Surface concept refreshers before tests for students below 60% accuracy.');

  return {
    summary: lines,
    recommendations: recs,
    generated_at: new Date().toISOString(),
  };
}

const getResearchDashboard = async (req, res) => {
  try {
    const [overall, acc, journey, learning, mock, heatmap, dropoffs, retention, personas, coach] = await Promise.all([
      rs.getOverall(),
      rs.getAccuracy(),
      getJourney(),
      getLearningAnalytics(),
      getMockAnalytics(),
      getTopicHeatmap(),
      getDropoffs(),
      getRetention(),
      getPersonas(),
      getCoach(),
    ]);
    res.json({ overall, accuracy: acc, journey, learning, mock, heatmap, dropoffs, retention, personas, coach });
  } catch (error) {
    console.error('Research dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch research data' });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await rs.getStudents();
    res.json({ students });
  } catch (error) {
    console.error('Student list error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

const getStudentDetail = async (req, res) => {
  try {
    const detail = await rs.getStudentDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Student not found' });
    res.json(detail);
  } catch (error) {
    console.error('Student detail error:', error);
    res.status(500).json({ error: 'Failed to fetch student detail' });
  }
};

module.exports = { getResearchDashboard, getStudents, getStudentDetail };
