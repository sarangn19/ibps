const { db } = require('../database/db');

const EXPECTED_TIME = { easy: 45, medium: 60, hard: 90 };
const THRESHOLDS = { strong: 70, developing: 40 };
const EVIDENCE_FOR_FULL = 8;   // attempts needed before a score is taken at face value
const EWMA_ALPHA = 0.3;        // weight given to the newest response
const DIFFICULTY_BONUS = { easy: 0, medium: 8, hard: 15 };

function safeJson(str, fallback) {
  try { return JSON.parse(str || fallback); } catch { return fallback; }
}

// Auto-attribution of errors without requiring a manual error_tag.
// Explicit tag wins; otherwise infer from time spent vs expected.
function inferErrorType({ is_correct, time_spent_seconds, difficulty, error_tag }) {
  if (is_correct) return null;
  if (error_tag) return error_tag;
  const expected = EXPECTED_TIME[difficulty] || 60;
  const t = time_spent_seconds || 0;
  if (t >= expected * 2) return 'time_out';
  if (t > 0 && t <= expected * 0.6) return 'silly_mistake';
  return 'concept_gap';
}

// Quality of a single response on a 0-100 scale.
// Correctness dominates; speed and difficulty add a calibrated bonus.
function responsePerf({ is_correct, time_spent_seconds, difficulty }) {
  const expected = EXPECTED_TIME[difficulty] || 60;
  const t = time_spent_seconds || 0;
  const ratio = t > 0 ? t / expected : 1.0;

  if (!is_correct) return 0;

  const speedBonus = Math.max(0, Math.min(5, 5 * (1 - (ratio - 0.75) / 0.75)));
  const perf = 80 + (DIFFICULTY_BONUS[difficulty] || 0) + speedBonus;
  return Math.min(100, perf);
}

// Effective score applies an evidence factor so thin samples don't read as mastery.
function effectiveScore(raw, attemptCount) {
  const evidence = Math.min(attemptCount / EVIDENCE_FOR_FULL, 1);
  return parseFloat((raw * evidence).toFixed(2));
}

function classify(score) {
  if (score >= THRESHOLDS.strong) return 'strong';
  if (score >= THRESHOLDS.developing) return 'developing';
  return 'weak';
}

function updateBucket(bucket, is_correct) {
  const b = bucket || { c: 0, a: 0 };
  b.a += 1;
  if (is_correct) b.c += 1;
  return b;
}

// Incremental, recency-weighted mastery update for a single response.
function recalculateMastery(userId, subject, topic, subtopic, response = {}) {
  const existing = db.prepare(
    `SELECT * FROM student_topic_mastery WHERE user_id = ? AND subject = ? AND topic = ? AND subtopic = ?`
  ).get(userId, subject, topic, subtopic);

  const prev = existing || {
    attempt_count: 0, accuracy_rolling: 0, avg_time_vs_expected: null,
    error_type_breakdown: '{}', raw_score: 0, mastery_score: 0, peak_score: 0,
    current_streak: 0, time_samples: 0, difficulty_accuracy: '{}', stage_accuracy: '{}'
  };

  const prevCount = prev.attempt_count || 0;
  const is_correct = response.is_correct ? 1 : 0;
  const attempt_count = prevCount + 1;

  // Accuracy (exact rolling mean)
  const accuracy_rolling = parseFloat(
    (((prev.accuracy_rolling || 0) * prevCount + (is_correct ? 100 : 0)) / attempt_count).toFixed(2)
  );

  // Expected-time ratio (rolling mean of time/expected as %)
  let avg_time_vs_expected = prev.avg_time_vs_expected;
  let time_samples = prev.time_samples || 0;
  if (response.time_spent_seconds) {
    const expected = EXPECTED_TIME[response.difficulty] || 60;
    const ratio = (response.time_spent_seconds / expected) * 100;
    avg_time_vs_expected = time_samples === 0
      ? parseFloat(ratio.toFixed(2))
      : parseFloat(((prev.avg_time_vs_expected * time_samples + ratio) / (time_samples + 1)).toFixed(2));
    time_samples += 1;
  }

  // Error breakdown with auto attribution
  const errorBreakdown = safeJson(prev.error_type_breakdown, {});
  const errorTag = inferErrorType(response);
  if (errorTag) errorBreakdown[errorTag] = (errorBreakdown[errorTag] || 0) + 1;

  // EWMA score update
  const perf = responsePerf(response);
  const raw_score = attempt_count === 1
    ? perf
    : parseFloat((EWMA_ALPHA * perf + (1 - EWMA_ALPHA) * (prev.raw_score || 0)).toFixed(2));
  const peak_score = Math.max(prev.peak_score || 0, raw_score);
  const mastery_score = effectiveScore(raw_score, attempt_count);

  // Difficulty / stage split
  const difficultyAccuracy = safeJson(prev.difficulty_accuracy, {});
  if (response.difficulty) difficultyAccuracy[response.difficulty] = updateBucket(difficultyAccuracy[response.difficulty], is_correct);
  const stageAccuracy = safeJson(prev.stage_accuracy, {});
  if (response.exam_stage) stageAccuracy[response.exam_stage] = updateBucket(stageAccuracy[response.exam_stage], is_correct);

  const last_result = is_correct;
  const current_streak = is_correct ? (prev.current_streak || 0) + 1 : 0;

  db.prepare(`
    INSERT INTO student_topic_mastery
      (user_id, subject, topic, subtopic, mastery_score, raw_score, attempt_count, accuracy_rolling,
       avg_time_vs_expected, error_type_breakdown, classification, last_result, current_streak,
       peak_score, time_samples, difficulty_accuracy, stage_accuracy, last_attempt_at, last_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, subject, topic, subtopic) DO UPDATE SET
      mastery_score = excluded.mastery_score,
      raw_score = excluded.raw_score,
      attempt_count = excluded.attempt_count,
      accuracy_rolling = excluded.accuracy_rolling,
      avg_time_vs_expected = excluded.avg_time_vs_expected,
      error_type_breakdown = excluded.error_type_breakdown,
      classification = excluded.classification,
      last_result = excluded.last_result,
      current_streak = excluded.current_streak,
      peak_score = excluded.peak_score,
      time_samples = excluded.time_samples,
      difficulty_accuracy = excluded.difficulty_accuracy,
      stage_accuracy = excluded.stage_accuracy,
      last_attempt_at = excluded.last_attempt_at,
      last_updated_at = excluded.last_updated_at
  `).run(
    userId, subject, topic, subtopic,
    mastery_score, raw_score, attempt_count, accuracy_rolling,
    avg_time_vs_expected, JSON.stringify(errorBreakdown), classify(mastery_score),
    last_result, current_streak, peak_score, time_samples,
    JSON.stringify(difficultyAccuracy), JSON.stringify(stageAccuracy)
  );
}

// Persist a point-in-time snapshot of a subtopic's mastery for trend tracking.
function snapshotMastery(userId, subject, topic, subtopic) {
  const row = db.prepare(
    `SELECT * FROM student_topic_mastery WHERE user_id = ? AND subject = ? AND topic = ? AND subtopic = ?`
  ).get(userId, subject, topic, subtopic);
  if (!row) return;

  db.prepare(`
    INSERT INTO mastery_history
      (user_id, subject, topic, subtopic, mastery_score, raw_score, classification, attempt_count,
       accuracy_rolling, avg_time_vs_expected, error_type_breakdown, difficulty_accuracy, snapshot_type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'attempt', datetime('now'))
  `).run(
    userId, subject, topic, subtopic,
    row.mastery_score, row.raw_score, row.classification, row.attempt_count,
    row.accuracy_rolling, row.avg_time_vs_expected, row.error_type_breakdown,
    row.difficulty_accuracy
  );
}

module.exports = { recalculateMastery, snapshotMastery, inferErrorType, effectiveScore };
