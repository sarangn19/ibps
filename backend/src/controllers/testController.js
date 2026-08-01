const pool = require('../database/db');

const getTests = async (req, res) => {
  try {
    const { batch_id, type, exam_stage } = req.query;

    let query = 'SELECT * FROM tests WHERE 1=1';
    const params = [];

    if (batch_id) {
      query += ' AND batch_id = ?';
      params.push(batch_id);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (exam_stage) {
      query += ' AND exam_stage = ?';
      params.push(exam_stage);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const rows = result.rows.map(r => ({ ...r, question_ids: JSON.parse(r.question_ids || '[]') }));
    res.json(rows);
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
};

const getTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tests WHERE id = ?', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = result.rows[0];

    // Parse question_ids from JSON string
    const questionIds = JSON.parse(test.question_ids || '[]');

    if (questionIds.length === 0) {
      test.questions = [];
      return res.json(test);
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const questionsResult = await pool.query(
      `SELECT q.*, s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
       FROM questions q
       LEFT JOIN question_sets s ON s.id = q.set_id
       WHERE q.id IN (${placeholders}) ORDER BY q.id`,
      questionIds
    );

    test.questions = questionsResult.rows;

    res.json(test);
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
};

const createTest = async (req, res) => {
  try {
    const {
      title, type, exam_stage, duration_minutes,
      negative_marking_ratio, batch_id, question_ids
    } = req.body;

    const result = await pool.query(
      `INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, question_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [title, type, exam_stage, duration_minutes, negative_marking_ratio, batch_id, JSON.stringify(question_ids)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
};

module.exports = { getTests, getTestById, createTest };
