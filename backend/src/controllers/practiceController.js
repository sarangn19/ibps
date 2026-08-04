const pool = require('../database/db');
const { parseQuestionIds } = require('../utils/questionIds');

const EASY_GA_TITLE = 'General Awareness — Easy Mode';

function withParsedIds(test) {
  return { ...test, question_ids: parseQuestionIds(test.question_ids) };
}

// Lazy-create (or return) the beginner-friendly GA practice set: easy questions
// across every GA topic, no negative marking, so students can build confidence
// before attempting full mocks.
const getEasyGA = async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM tests WHERE title = ? ORDER BY id LIMIT 1',
      [EASY_GA_TITLE]
    );
    if (existing.rows.length > 0) {
      return res.json(withParsedIds(existing.rows[0]));
    }

    const idsResult = await pool.query(
      `SELECT id FROM questions
       WHERE subject = ? AND difficulty = 'easy'
       ORDER BY RANDOM() LIMIT 15`,
      ['General Awareness']
    );
    const ids = idsResult.rows.map(r => r.id);

    if (ids.length === 0) {
      return res.status(404).json({ error: 'No easy General Awareness questions available yet' });
    }

    const insert = await pool.query(
      `INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, question_ids)
       VALUES (?, 'topic_practice', 'prelims', 15, 0, ?)
       RETURNING *`,
      [EASY_GA_TITLE, JSON.stringify(ids)]
    );

    res.status(201).json(withParsedIds(insert.rows[0]));
  } catch (error) {
    console.error('Get easy GA error:', error);
    res.status(500).json({ error: 'Failed to prepare easy GA practice' });
  }
};

const startPractice = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { subject, topic, subtopic, difficulty, count = 10, timed = true, duration_minutes = 15 } = req.body;

    let query = 'SELECT id FROM questions WHERE 1=1';
    const params = [];

    if (subject) { query += ' AND subject = ?'; params.push(subject); }
    if (topic) { query += ' AND topic = ?'; params.push(topic); }
    if (subtopic) { query += ' AND subtopic = ?'; params.push(subtopic); }
    if (difficulty) { query += ' AND difficulty = ?'; params.push(difficulty); }

    query += ' ORDER BY RANDOM() LIMIT ?';
    params.push(Math.min(count, 50));

    const idsResult = await pool.query(query, params);
    const ids = idsResult.rows.map(r => r.id);

    if (ids.length === 0) {
      return res.status(404).json({ error: 'No questions found matching criteria' });
    }

    const title = `${subject || 'All Subjects'} - ${topic || 'Mixed Topics'} Practice`;

    const testResult = await pool.query(
      `INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, question_ids)
       VALUES (?, 'topic_practice', 'prelims', ?, 0.25, ?)
       RETURNING *`,
      [title, timed ? duration_minutes : 0, JSON.stringify(ids)]
    );

    const test = testResult.rows[0];

    res.status(201).json({ test, question_count: ids.length });
  } catch (error) {
    console.error('Start practice error:', error);
    res.status(500).json({ error: 'Failed to start practice session' });
  }
};

module.exports = { startPractice, getEasyGA };
