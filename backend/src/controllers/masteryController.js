const pool = require('../database/db');

function safeJson(str, fallback) {
  try { return JSON.parse(str || fallback); } catch { return fallback; }
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

const getMyMap = async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query(
      'SELECT * FROM student_topic_mastery WHERE user_id = ? ORDER BY subject, topic, subtopic',
      [user_id]
    );

    const tree = {};
    for (const row of result.rows) {
      if (!tree[row.subject]) tree[row.subject] = { subject: row.subject, topics: {} };
      if (!tree[row.subject].topics[row.topic]) tree[row.subject].topics[row.topic] = { topic: row.topic, subtopics: [] };
      tree[row.subject].topics[row.topic].subtopics.push({
        subtopic: row.subtopic,
        mastery_score: row.mastery_score,
        raw_score: row.raw_score,
        attempt_count: row.attempt_count,
        accuracy_rolling: row.accuracy_rolling,
        avg_time_vs_expected: row.avg_time_vs_expected,
        error_type_breakdown: safeJson(row.error_type_breakdown, {}),
        classification: row.classification,
        last_result: row.last_result,
        current_streak: row.current_streak,
        peak_score: row.peak_score,
        difficulty_accuracy: safeJson(row.difficulty_accuracy, {}),
        stage_accuracy: safeJson(row.stage_accuracy, {}),
        last_attempt_at: row.last_attempt_at,
        days_since_last_attempt: daysSince(row.last_attempt_at),
        last_updated_at: row.last_updated_at
      });
    }

    const result_arr = Object.values(tree).map(s => ({
      ...s,
      topics: Object.values(s.topics)
    }));

    res.json(result_arr);
  } catch (error) {
    console.error('Get mastery map error:', error);
    res.status(500).json({ error: 'Failed to fetch mastery data' });
  }
};

const getHistory = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { subject, topic, subtopic } = req.query;
    if (!subject || !topic || subtopic === undefined) {
      return res.status(400).json({ error: 'subject, topic, and subtopic query params are required' });
    }

    const result = await pool.query(
      `SELECT mastery_score, raw_score, classification, attempt_count, accuracy_rolling,
              avg_time_vs_expected, error_type_breakdown, difficulty_accuracy, timestamp
       FROM mastery_history
       WHERE user_id = ? AND subject = ? AND topic = ? AND subtopic = ?
       ORDER BY timestamp ASC`,
      [user_id, subject, topic, subtopic]
    );

    res.json(result.rows.map(r => ({
      ...r,
      error_type_breakdown: safeJson(r.error_type_breakdown, {}),
      difficulty_accuracy: safeJson(r.difficulty_accuracy, {})
    })));
  } catch (error) {
    console.error('Get mastery history error:', error);
    res.status(500).json({ error: 'Failed to fetch mastery history' });
  }
};

const getRecommendations = async (req, res) => {
  try {
    const user_id = req.user.id;

    const rows = await pool.query(
      'SELECT * FROM student_topic_mastery WHERE user_id = ?',
      [user_id]
    );

    const candidates = [];

    for (const row of rows.rows) {
      const breakdown = safeJson(row.error_type_breakdown, {});
      const conceptErrors = (breakdown.concept_gap || 0) + (breakdown.time_out || 0);
      const peak = row.peak_score || 0;
      const regression = peak >= 70 && (row.mastery_score || 0) < peak - 25 && row.attempt_count >= 3;
      const dueDays = daysSince(row.last_attempt_at);

      let priority = null;
      let reason = null;

      if (['weak', 'developing'].includes(row.classification) && conceptErrors >= 3) {
        priority = 1;
        reason = `Focus here — ${conceptErrors} concept/time errors in this subtopic`;
      } else if (regression) {
        priority = 2;
        reason = `Dropped from ${Math.round(peak)}% to ${Math.round(row.mastery_score || 0)}% — review to recover`;
      } else if (['weak', 'developing'].includes(row.classification)) {
        priority = 3;
        reason = `Only ${(row.accuracy_rolling || 0).toFixed(0)}% accuracy across ${row.attempt_count} attempts`;
      } else if (['strong', 'developing'].includes(row.classification) && dueDays !== null && dueDays >= 7) {
        priority = 4;
        reason = `Not reviewed in ${dueDays} day${dueDays === 1 ? '' : 's'} — keep it fresh`;
      }

      if (priority !== null) {
        candidates.push({
          subject: row.subject, topic: row.topic, subtopic: row.subtopic,
          classification: row.classification, score: row.mastery_score,
          priority, reason
        });
      }
    }

    const MIN_QUESTIONS = 3;

    candidates.sort((a, b) => a.priority - b.priority || (b.score || 0) - (a.score || 0));

    // Resolve each candidate to a usable practice scope. Subtopics with too few
    // questions roll up to the whole topic; if neither has enough, skip.
    const resolved = [];
    const seen = new Set();
    for (const target of candidates) {
      if (resolved.length >= 5) break;

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

      resolved.push({ ...target, available, scope });
    }

    // Fill remaining slots with never-attempted subtopics that actually have questions
    if (resolved.length < 5) {
      const neverResult = await pool.query(
        `SELECT q.subject, q.topic, q.subtopic, COUNT(*) AS c
         FROM questions q
         WHERE NOT EXISTS (
           SELECT 1 FROM student_topic_mastery stm
           WHERE stm.user_id = ? AND stm.subject = q.subject AND stm.topic = q.topic AND stm.subtopic = q.subtopic
         )
         AND q.subtopic IS NOT NULL AND q.subtopic != ''
         GROUP BY q.subject, q.topic, q.subtopic
         HAVING COUNT(*) >= ?
         ORDER BY RANDOM()
         LIMIT ?`,
        [user_id, MIN_QUESTIONS, 5 - resolved.length]
      );
      for (const r of neverResult.rows) {
        resolved.push({
          subject: r.subject, topic: r.topic, subtopic: r.subtopic,
          classification: 'not_attempted', score: 0, priority: 5,
          reason: `You haven't practiced this yet — ${r.c} questions available`,
          available: r.c,
          scope: { subject: r.subject, topic: r.topic, subtopic: r.subtopic }
        });
      }
    }

    const recommendations = [];
    for (const target of resolved.slice(0, 5)) {
      const { subject, topic, subtopic } = target.scope;
      const questions = await pool.query(
        `SELECT id, question_text, subject, topic, subtopic, difficulty, option_a, option_b, option_c, option_d, option_e
         FROM questions
         WHERE subject = ? AND topic = ? ${subtopic ? 'AND subtopic = ?' : ''}
         ORDER BY RANDOM() LIMIT 3`,
        subtopic ? [subject, topic, subtopic] : [subject, topic]
      );
      recommendations.push({ ...target, questions: questions.rows });
    }

    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

module.exports = { getMyMap, getHistory, getRecommendations };
