const pool = require('../database/db');

const getStudents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.batch_id, u.created_at, b.name as batch_name,
        (SELECT COUNT(*) FROM attempts WHERE user_id = u.id AND status = 'completed') as tests_completed,
        (SELECT ROUND(AVG(total_score), 2) FROM attempts WHERE user_id = u.id AND status = 'completed' AND total_score IS NOT NULL) as avg_score,
        (SELECT MAX(a.started_at) FROM attempts a WHERE a.user_id = u.id) as last_active
      FROM users u
      LEFT JOIN batches b ON b.id = u.batch_id
      WHERE u.role = 'student'
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

const getStudentDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      'SELECT u.*, b.name as batch_name FROM users u LEFT JOIN batches b ON b.id = u.batch_id WHERE u.id = ?',
      [id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = userResult.rows[0];

    const attemptsResult = await pool.query(`
      SELECT a.*, t.title as test_title, t.type as test_type
      FROM attempts a
      JOIN tests t ON t.id = a.test_id
      WHERE a.user_id = ?
      ORDER BY a.started_at DESC
    `, [id]);

    const masteryResult = await pool.query(
      'SELECT * FROM student_topic_mastery WHERE user_id = ? ORDER BY subject, topic, subtopic',
      [id]
    );

    const logsResult = await pool.query(
      'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
      [id]
    );

    // Calculate accuracy/speed trend
    const trendResult = await pool.query(`
      SELECT a.started_at as date, a.total_score,
        (SELECT COUNT(*) FROM question_responses qr WHERE qr.attempt_id = a.id AND qr.is_correct = 1) as correct,
        (SELECT COUNT(*) FROM question_responses qr WHERE qr.attempt_id = a.id AND qr.selected_option IS NOT NULL) as attempted
      FROM attempts a
      WHERE a.user_id = ? AND a.status = 'completed'
      ORDER BY a.started_at ASC
    `, [id]);

    res.json({ student, attempts: attemptsResult.rows, mastery: masteryResult.rows, logs: logsResult.rows, trends: trendResult.rows });
  } catch (error) {
    console.error('Get student detail error:', error);
    res.status(500).json({ error: 'Failed to fetch student details' });
  }
};

const getCohort = async (req, res) => {
  try {
    const { batch_id } = req.query;

    let batchFilter = '';
    const params = [];
    if (batch_id) { batchFilter = ' AND u.batch_id = ?'; params.push(batch_id); }

    const subjectsResult = await pool.query(`
      SELECT q.subject, 
        COUNT(DISTINCT qr.id) as total_attempts,
        SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
        ROUND(AVG(CASE WHEN qr.is_correct = 1 THEN 1.0 ELSE 0.0 END) * 100, 1) as accuracy
      FROM question_responses qr
      JOIN questions q ON q.id = qr.question_id
      JOIN attempts a ON a.id = qr.attempt_id
      JOIN users u ON u.id = a.user_id
      WHERE u.role = 'student'${batchFilter} AND qr.selected_option IS NOT NULL
      GROUP BY q.subject
      ORDER BY accuracy ASC
    `, params);

    const engagementResult = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id) as total_students,
        COUNT(DISTINCT CASE WHEN a.status = 'in_progress' THEN a.id END) as tests_in_progress,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as tests_completed,
        COUNT(DISTINCT CASE WHEN a.status = 'abandoned' THEN a.id END) as tests_abandoned
      FROM users u
      LEFT JOIN attempts a ON a.user_id = u.id
      WHERE u.role = 'student'${batchFilter}
    `, params);

    let distQuery = `
      SELECT 
        CASE 
          WHEN a.total_score < 0 THEN 'negative'
          WHEN a.total_score = 0 THEN 'zero'
          WHEN a.total_score <= 25 THEN '1-25'
          WHEN a.total_score <= 50 THEN '26-50'
          WHEN a.total_score <= 75 THEN '51-75'
          ELSE '76+'
        END as score_range,
        COUNT(*) as count
      FROM attempts a
      JOIN users u ON u.id = a.user_id
      WHERE u.role = 'student' AND a.status = 'completed'`;
    if (batch_id) distQuery += ' AND u.batch_id = ?';
    distQuery += ' GROUP BY score_range ORDER BY score_range';

    const scoreDistResult = await pool.query(distQuery, params);

    res.json({
      subjects: subjectsResult.rows,
      engagement: engagementResult.rows[0] || {},
      score_distribution: scoreDistResult.rows
    });
  } catch (error) {
    console.error('Get cohort error:', error);
    res.status(500).json({ error: 'Failed to fetch cohort data' });
  }
};

const getFlags = async (req, res) => {
  try {
    const flags = [];

    // Flag 1: Inactivity > 7 days
    const inactiveResult = await pool.query(`
      SELECT u.id, u.name, u.email, b.name as batch_name,
        COALESCE((SELECT MAX(a.started_at) FROM attempts a WHERE a.user_id = u.id), u.created_at) as last_active
      FROM users u
      LEFT JOIN batches b ON b.id = u.batch_id
      WHERE u.role = 'student'
      AND COALESCE((SELECT MAX(a.started_at) FROM attempts a WHERE a.user_id = u.id), u.created_at) < to_char(now() - interval '7 days', 'YYYY-MM-DD HH24:MI:SS')
      ORDER BY last_active ASC
    `);
    for (const s of inactiveResult.rows) {
      flags.push({
        student_id: s.id, student_name: s.name, batch: s.batch_name,
        type: 'inactivity', severity: 'warning',
        message: `No activity since ${new Date(s.last_active).toLocaleDateString()}`
      });
    }

    // Flag 2: Sudden accuracy drop (>40% drop between last two completed tests)
    const dropResult = await pool.query(`
      SELECT a.user_id, u.name, a.id, a.total_score, a.started_at
      FROM attempts a
      JOIN users u ON u.id = a.user_id
      WHERE u.role = 'student' AND a.status = 'completed'
      ORDER BY a.user_id, a.started_at DESC
    `);
    const userTests = {};
    for (const row of dropResult.rows) {
      if (!userTests[row.user_id]) userTests[row.user_id] = [];
      if (userTests[row.user_id].length < 2) userTests[row.user_id].push(row);
    }
    for (const [uid, tests] of Object.entries(userTests)) {
      if (tests.length >= 2) {
        const [latest, prev] = tests;
        if (prev.total_score > 0 && latest.total_score < prev.total_score * 0.6) {
          flags.push({
            student_id: Number(uid), student_name: tests[0].name,
            type: 'accuracy_drop', severity: 'critical',
            message: `Score dropped from ${prev.total_score} to ${latest.total_score}`
          });
        }
      }
    }

    // Flag 3: Consistent time-outs (abandoned > 2 tests)
    const timeoutResult = await pool.query(`
      SELECT u.id, u.name, COUNT(*) as abandoned_count
      FROM attempts a
      JOIN users u ON u.id = a.user_id
      WHERE u.role = 'student' AND a.status = 'abandoned'
      GROUP BY u.id
      HAVING COUNT(*) > 2
    `);
    for (const s of timeoutResult.rows) {
      flags.push({
        student_id: s.id, student_name: s.name,
        type: 'timeout_pattern', severity: 'warning',
        message: `${s.abandoned_count} abandoned tests`
      });
    }

    res.json(flags);
  } catch (error) {
    console.error('Get flags error:', error);
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
};

const getBatches = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, exam_type, start_date FROM batches ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
};

module.exports = { getStudents, getStudentDetail, getCohort, getFlags, getBatches };
