const pool = require('../database/db');
const { parseQuestionIds } = require('../utils/questionIds');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// Self-migrating: adds the daily_revisions tracking table on boot.
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_revisions (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        day TEXT NOT NULL,
        created_at TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
        UNIQUE(user_id, day)
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_revisions_user_day ON daily_revisions(user_id, day)`);
  } finally {
    client.release();
  }
}

async function computeStreak(user_id) {
  const result = await pool.query(
    'SELECT day FROM daily_revisions WHERE user_id = ? ORDER BY day DESC',
    [user_id]
  );
  const checked = new Set(result.rows.map(r => r.day));

  const t = today();
  const anchor = checked.has(t) ? t : (() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toISOString().slice(0, 10);
  })();

  let streak = 0;
  if (checked.has(anchor)) {
    const cursor = new Date(anchor);
    while (checked.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return { streak, today_checked: checked.has(t) };
}

// Resolve weak/developing subtopics to a usable practice scope, rolling up to
// the whole topic when a subtopic has too few questions.
async function resolveDueTopics(user_id, rows, max = 5) {
  const MIN_QUESTIONS = 3;
  const candidates = rows.map(r => ({
    subject: r.subject, topic: r.topic, subtopic: r.subtopic,
    classification: r.classification, accuracy_rolling: r.accuracy_rolling,
    last_attempt_at: r.last_attempt_at, days_since_last_attempt: daysSince(r.last_attempt_at)
  }));

  const resolved = [];
  const seen = new Set();
  for (const target of candidates) {
    if (resolved.length >= max) break;

    const exactCount = (await pool.query(
      'SELECT COUNT(*) AS c FROM questions WHERE subject = ? AND topic = ? AND subtopic = ?',
      [target.subject, target.topic, target.subtopic]
    )).rows[0].c;

    let scope = { subject: target.subject, topic: target.topic, subtopic: target.subtopic };
    let available = exactCount;

    if (exactCount < MIN_QUESTIONS) {
      const topicCount = (await pool.query(
        'SELECT COUNT(*) AS c FROM questions WHERE subject = ? AND topic = ?',
        [target.subject, target.topic]
      )).rows[0].c;
      if (topicCount < MIN_QUESTIONS) continue;
      scope = { subject: target.subject, topic: target.topic, subtopic: null };
      available = topicCount;
    }

    const dedupeKey = `${scope.subject}|${scope.topic}|${scope.subtopic || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    resolved.push({ ...target, scope, available });
  }

  return resolved;
}

const getDaily = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { streak, today_checked } = await computeStreak(user_id);

    const rows = await pool.query(
      `SELECT subject, topic, subtopic, classification, accuracy_rolling, last_attempt_at
       FROM student_topic_mastery
       WHERE user_id = ?
         AND (classification IN ('weak', 'developing') OR (accuracy_rolling IS NOT NULL AND accuracy_rolling < 60))
       ORDER BY (last_attempt_at IS NULL) DESC, last_attempt_at ASC
       LIMIT 12`,
      [user_id]
    );

    const due_topics = await resolveDueTopics(user_id, rows.rows, 5);

    res.json({ streak, today_checked, due_topics });
  } catch (error) {
    console.error('Get daily revision error:', error);
    res.status(500).json({ error: 'Failed to fetch daily revision' });
  }
};

const checkIn = async (req, res) => {
  try {
    const user_id = req.user.id;
    const t = today();

    await pool.query(
      `INSERT INTO daily_revisions (user_id, day) VALUES (?, ?)
       ON CONFLICT (user_id, day) DO NOTHING`,
      [user_id, t]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, event_type, metadata) VALUES (?, ?, ?)',
      [user_id, 'daily_revision', JSON.stringify({ day: t })]
    );

    const { streak, today_checked } = await computeStreak(user_id);
    res.json({ streak, today_checked });
  } catch (error) {
    console.error('Revision check-in error:', error);
    res.status(500).json({ error: 'Failed to save revision check-in' });
  }
};

const getPreTest = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { testId } = req.params;

    const testResult = await pool.query('SELECT * FROM tests WHERE id = ?', [testId]);
    if (testResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }
    const test = testResult.rows[0];

    const inProgress = await pool.query(
      `SELECT id FROM attempts WHERE user_id = ? AND test_id = ? AND status = 'in_progress' LIMIT 1`,
      [user_id, testId]
    );
    if (inProgress.rows.length > 0) {
      return res.json({ in_progress: true, refresher: [] });
    }

    const questionIds = parseQuestionIds(test.question_ids);
    if (questionIds.length === 0) {
      return res.json({ in_progress: false, refresher: [] });
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const topicsResult = await pool.query(
      `SELECT subject, topic, subtopic, COUNT(*) AS c
       FROM questions
       WHERE id IN (${placeholders})
       GROUP BY subject, topic, subtopic`,
      questionIds
    );

    const refresher = [];
    for (const key of topicsResult.rows) {
      const mastery = await pool.query(
        `SELECT classification, accuracy_rolling FROM student_topic_mastery
         WHERE user_id = ? AND subject = ? AND topic = ? AND subtopic = ?`,
        [user_id, key.subject, key.topic, key.subtopic]
      );
      const row = mastery.rows[0];
      if (!row) continue;

      const below60 = row.accuracy_rolling !== null && row.accuracy_rolling < 60;
      const weak = ['weak', 'developing'].includes(row.classification);
      if (below60 || weak) {
        refresher.push({
          subject: key.subject,
          topic: key.topic,
          subtopic: key.subtopic,
          classification: row.classification,
          accuracy_rolling: row.accuracy_rolling,
          available: key.c
        });
      }
    }

    res.json({ in_progress: false, refresher });
  } catch (error) {
    console.error('Get pre-test refresher error:', error);
    res.status(500).json({ error: 'Failed to fetch pre-test refresher' });
  }
};

module.exports = { ensureSchema, getDaily, checkIn, getPreTest };
