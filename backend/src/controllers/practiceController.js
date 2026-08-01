const pool = require('../database/db');

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

module.exports = { startPractice };
