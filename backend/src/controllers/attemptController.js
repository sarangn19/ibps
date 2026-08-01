const pool = require('../database/db');
const { recalculateMastery, snapshotMastery } = require('../services/masteryService');
const { parseQuestionIds } = require('../utils/questionIds');

const startAttempt = async (req, res) => {
  try {
    const { test_id } = req.body;
    const user_id = req.user.id;

    const testResult = await pool.query('SELECT * FROM tests WHERE id = ?', [test_id]);
    if (testResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }
    const test = testResult.rows[0];

    const attemptResult = await pool.query(
      `INSERT INTO attempts (user_id, test_id, status)
       VALUES (?, ?, 'in_progress')
       RETURNING *`,
      [user_id, test_id]
    );

    const attempt = attemptResult.rows[0];

    await pool.query(
      'INSERT INTO activity_logs (user_id, event_type, metadata) VALUES (?, ?, ?)',
      [user_id, 'test_started', JSON.stringify({ test_id, attempt_id: attempt.id })]
    );

    // Parse question_ids (JSON text or Postgres array literal)
    const questionIds = parseQuestionIds(test.question_ids);
    test.question_ids = questionIds;

    if (questionIds.length === 0) {
      return res.status(201).json({ attempt, test, questions: [] });
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const questionsResult = await pool.query(
      `SELECT q.*, s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
       FROM questions q
       LEFT JOIN question_sets s ON s.id = q.set_id
       WHERE q.id IN (${placeholders}) ORDER BY q.id`,
      questionIds
    );

    res.status(201).json({
      attempt,
      test,
      questions: questionsResult.rows
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: 'Failed to start attempt' });
  }
};

const saveResponse = async (req, res) => {
  try {
    const { attempt_id, question_id, selected_option, time_spent_seconds, marked_for_review } = req.body;
    const user_id = req.user.id;

    const attemptResult = await pool.query(
      'SELECT * FROM attempts WHERE id = ? AND user_id = ?',
      [attempt_id, user_id]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Attempt is not in progress' });
    }

    const questionResult = await pool.query(
      'SELECT correct_option, subject, topic, subtopic, difficulty, exam_stage FROM questions WHERE id = ?',
      [question_id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const q = questionResult.rows[0];
    const is_correct = selected_option === q.correct_option ? 1 : 0;

    const existingResponse = await pool.query(
      'SELECT id FROM question_responses WHERE attempt_id = ? AND question_id = ?',
      [attempt_id, question_id]
    );

    let response;
    if (existingResponse.rows.length > 0) {
      const updateResult = await pool.query(
        `UPDATE question_responses 
         SET selected_option = ?, is_correct = ?, time_spent_seconds = ?, marked_for_review = ?
         WHERE attempt_id = ? AND question_id = ?
         RETURNING *`,
        [selected_option, is_correct, time_spent_seconds, marked_for_review ? 1 : 0, attempt_id, question_id]
      );
      response = updateResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO question_responses (attempt_id, question_id, selected_option, is_correct, time_spent_seconds, marked_for_review)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [attempt_id, question_id, selected_option, is_correct, time_spent_seconds, marked_for_review ? 1 : 0]
      );
      response = insertResult.rows[0];
    }

    // Real-time mastery recalculation (incremental, recency-weighted)
    try {
      await recalculateMastery(attempt.user_id, q.subject, q.topic, q.subtopic, {
        is_correct: Boolean(is_correct),
        time_spent_seconds: response.time_spent_seconds,
        error_tag: response.error_tag,
        difficulty: q.difficulty,
        exam_stage: q.exam_stage
      });
    } catch (e) {
      console.error('Mastery recalculation error:', e);
    }

    res.json(response);
  } catch (error) {
    console.error('Save response error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
};

const submitAttempt = async (req, res) => {
  try {
    const { attempt_id } = req.body;
    const user_id = req.user.id;

    const attemptResult = await pool.query(
      'SELECT * FROM attempts WHERE id = ? AND user_id = ?',
      [attempt_id, user_id]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Attempt is not in progress' });
    }

    const testResult = await pool.query('SELECT * FROM tests WHERE id = ?', [attempt.test_id]);
    const test = testResult.rows[0];

    const responsesResult = await pool.query(
      'SELECT * FROM question_responses WHERE attempt_id = ?',
      [attempt_id]
    );

    const responses = responsesResult.rows;
    let total_score = 0;
    let correct_count = 0;
    let attempted_count = 0;

    responses.forEach(response => {
      if (response.selected_option) {
        attempted_count++;
        if (response.is_correct) {
          total_score += 1;
          correct_count++;
        } else {
          total_score -= test.negative_marking_ratio;
        }
      }
    });

    const section_scores = {};
    for (const response of responses) {
      if (!response.selected_option) continue;

      const question = await pool.query('SELECT subject FROM questions WHERE id = ?', [response.question_id]);
      const subject = question.rows[0].subject;

      if (!section_scores[subject]) {
        section_scores[subject] = { correct: 0, attempted: 0, score: 0 };
      }

      section_scores[subject].attempted++;
      if (response.is_correct) {
        section_scores[subject].correct++;
        section_scores[subject].score += 1;
      } else {
        section_scores[subject].score -= test.negative_marking_ratio;
      }
    }

    const updateResult = await pool.query(
      `UPDATE attempts 
       SET submitted_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), total_score = ?, section_scores = ?, status = 'completed'
       WHERE id = ?
       RETURNING *`,
      [total_score, JSON.stringify(section_scores), attempt_id]
    );

    const updatedAttempt = updateResult.rows[0];

    await pool.query(
      'INSERT INTO activity_logs (user_id, event_type, metadata) VALUES (?, ?, ?)',
      [user_id, 'test_submitted', JSON.stringify({ test_id: attempt.test_id, attempt_id, score: total_score })]
    );

    // Snapshot mastery history for every subtopic touched in this attempt
    try {
      const touchedResult = await pool.query(
        `SELECT DISTINCT q.subject, q.topic, q.subtopic
         FROM question_responses qr
         JOIN questions q ON q.id = qr.question_id
         WHERE qr.attempt_id = ?`,
        [attempt_id]
      );
      for (const key of touchedResult.rows) {
        await snapshotMastery(user_id, key.subject, key.topic, key.subtopic);
      }
    } catch (e) {
      console.error('Mastery snapshot error:', e);
    }

    res.json({
      attempt: updatedAttempt,
      total_score,
      correct_count,
      attempted_count,
      total_questions: JSON.parse(test.question_ids).length,
      accuracy: attempted_count > 0 ? (correct_count / attempted_count * 100).toFixed(2) : 0,
      section_scores
    });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Failed to submit attempt' });
  }
};

const getAttemptResults = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const user_id = req.user.id;

    const attemptResult = await pool.query(
      'SELECT * FROM attempts WHERE id = ? AND user_id = ?',
      [attempt_id, user_id]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    const testResult = await pool.query('SELECT * FROM tests WHERE id = ?', [attempt.test_id]);
    const test = testResult.rows[0];

    const responsesResult = await pool.query(
      `SELECT qr.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.correct_option, q.explanation, q.subject, q.topic, q.subtopic, q.difficulty,
              s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
       FROM question_responses qr
       JOIN questions q ON qr.question_id = q.id
       LEFT JOIN question_sets s ON s.id = q.set_id
       WHERE qr.attempt_id = ?
       ORDER BY qr.question_id`,
      [attempt_id]
    );

    res.json({
      attempt,
      test,
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('Get attempt results error:', error);
    res.status(500).json({ error: 'Failed to fetch attempt results' });
  }
};

const updateErrorTag = async (req, res) => {
  try {
    const { response_id, error_tag } = req.body;
    const user_id = req.user.id;

    const result = await pool.query(
      `UPDATE question_responses
       SET error_tag = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM attempts WHERE attempts.id = question_responses.attempt_id AND attempts.user_id = ?
       )
       RETURNING *`,
      [error_tag, response_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update error tag error:', error);
    res.status(500).json({ error: 'Failed to update error tag' });
  }
};

const getMyHistory = async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT t.id as test_id, t.title, t.type, t.exam_stage,
              a.id as attempt_id, a.total_score, a.status, a.started_at, a.submitted_at
       FROM tests t
       LEFT JOIN attempts a ON a.test_id = t.id AND a.user_id = ?
       ORDER BY t.id, a.started_at DESC`,
      [user_id]
    );

    const testsMap = {};
    for (const row of result.rows) {
      if (!testsMap[row.test_id]) {
        testsMap[row.test_id] = {
          test_id: row.test_id,
          title: row.title,
          type: row.type,
          exam_stage: row.exam_stage,
          attempts: [],
          last_attempt: null,
          best_score: null,
          best_accuracy: null
        };
      }
      if (row.attempt_id) {
        testsMap[row.test_id].attempts.push({
          attempt_id: row.attempt_id,
          total_score: row.total_score,
          status: row.status,
          started_at: row.started_at,
          submitted_at: row.submitted_at
        });
        if (!testsMap[row.test_id].last_attempt || row.started_at > testsMap[row.test_id].last_attempt.started_at) {
          testsMap[row.test_id].last_attempt = { started_at: row.started_at, score: row.total_score };
        }
        if (row.total_score !== null && (testsMap[row.test_id].best_score === null || row.total_score > testsMap[row.test_id].best_score)) {
          testsMap[row.test_id].best_score = row.total_score;
        }
      }
    }

    res.json(Object.values(testsMap));
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

module.exports = { startAttempt, saveResponse, submitAttempt, getAttemptResults, updateErrorTag, getMyHistory };
