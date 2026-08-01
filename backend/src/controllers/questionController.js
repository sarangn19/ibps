const pool = require('../database/db');

const getQuestions = async (req, res) => {
  try {
    const { subject, topic, difficulty, exam_stage } = req.query;

    let query = `
      SELECT q.*, s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
      FROM questions q
      LEFT JOIN question_sets s ON s.id = q.set_id
      WHERE 1=1`;
    const params = [];

    if (subject) {
      query += ' AND q.subject = ?';
      params.push(subject);
    }

    if (topic) {
      query += ' AND q.topic = ?';
      params.push(topic);
    }

    if (difficulty) {
      query += ' AND q.difficulty = ?';
      params.push(difficulty);
    }

    if (exam_stage) {
      query += ' AND q.exam_stage = ?';
      params.push(exam_stage);
    }

    query += ' ORDER BY q.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

const buildWhere = ({ subject, topic, difficulty, exam_stage, q }) => {
  let where = 'WHERE 1=1';
  const params = [];
  if (subject) { where += ' AND q.subject = ?'; params.push(subject); }
  if (topic) { where += ' AND q.topic = ?'; params.push(topic); }
  if (difficulty) { where += ' AND q.difficulty = ?'; params.push(difficulty); }
  if (exam_stage) { where += ' AND q.exam_stage = ?'; params.push(exam_stage); }
  if (q) { where += ' AND q.question_text LIKE ?'; params.push(`%${q}%`); }
  return { where, params };
};

const getAdminQuestions = async (req, res) => {
  try {
    const { subject, topic, difficulty, exam_stage, q } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { where, params } = buildWhere({ subject, topic, difficulty, exam_stage, q });

    const totalRow = await pool.query(`SELECT count(*) AS c FROM questions q ${where}`, params);
    const result = await pool.query(
      `SELECT q.*, s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
       FROM questions q
       LEFT JOIN question_sets s ON s.id = q.set_id
       ${where}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      questions: result.rows,
      total: totalRow.rows[0].c,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get admin questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

const getQuestionStats = async (req, res) => {
  try {
    const totalRow = await pool.query('SELECT count(*) AS c FROM questions');
    const bySubject = await pool.query('SELECT subject, count(*) AS c FROM questions GROUP BY subject ORDER BY c DESC');
    const byTopic = await pool.query('SELECT subject, topic, count(*) AS c FROM questions GROUP BY subject, topic ORDER BY c DESC');
    res.json({
      total: totalRow.rows[0].c,
      by_subject: bySubject.rows,
      by_topic: byTopic.rows
    });
  } catch (error) {
    console.error('Get question stats error:', error);
    res.status(500).json({ error: 'Failed to fetch question stats' });
  }
};

const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT q.*, s.set_type, s.title AS set_title, s.stimulus AS set_stimulus, s.source AS set_source
       FROM questions q
       LEFT JOIN question_sets s ON s.id = q.set_id
       WHERE q.id = ?`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
};

const createQuestion = async (req, res) => {
  try {
    const {
      subject, topic, subtopic, difficulty, question_text,
      option_a, option_b, option_c, option_d, option_e, correct_option,
      explanation, exam_stage, tags, set_title, set_type, set_stimulus
    } = req.body;

    let setId = null;
    if (set_title) {
      const setInfo = pool.db.prepare(
        `INSERT INTO question_sets (set_type, title, stimulus) VALUES (?, ?, ?)`
      ).run(set_type || 'group', set_title, set_stimulus || set_title);
      setId = Number(setInfo.lastInsertRowid);
    }

    const result = await pool.query(
      `INSERT INTO questions 
       (subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, exam_stage, tags, set_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, exam_stage, JSON.stringify(tags || []), setId, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject, topic, subtopic, difficulty, question_text,
      option_a, option_b, option_c, option_d, option_e, correct_option,
      explanation, exam_stage, tags, set_title, set_type, set_stimulus
    } = req.body;

    const existing = await pool.query('SELECT id, set_id FROM questions WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let setId = existing.rows[0].set_id || null;
    if (set_title !== undefined) {
      if (set_title) {
        if (existing.rows[0].set_id) {
          pool.db.prepare(
            `UPDATE question_sets SET title = ?, set_type = ?, stimulus = ? WHERE id = ?`
          ).run(set_title, set_type || 'group', set_stimulus || set_title, existing.rows[0].set_id);
        } else {
          const setInfo = pool.db.prepare(
            `INSERT INTO question_sets (set_type, title, stimulus) VALUES (?, ?, ?)`
          ).run(set_type || 'group', set_title, set_stimulus || set_title);
          setId = Number(setInfo.lastInsertRowid);
        }
      } else {
        setId = null;
      }
    }

    const result = await pool.query(
      `UPDATE questions SET
         subject = ?, topic = ?, subtopic = ?, difficulty = ?, question_text = ?,
         option_a = ?, option_b = ?, option_c = ?, option_d = ?, option_e = ?,
         correct_option = ?, explanation = ?, exam_stage = ?, tags = ?, set_id = ?
       WHERE id = ?
       RETURNING *`,
      [
        subject, topic, subtopic, difficulty, question_text,
        option_a, option_b, option_c, option_d, option_e,
        correct_option, explanation, exam_stage,
        JSON.stringify(tags || []), setId, id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id FROM questions WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await pool.query('DELETE FROM question_responses WHERE question_id = ?', [id]);
    await pool.query('DELETE FROM questions WHERE id = ?', [id]);

    res.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

const getSubjects = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT subject, topic, subtopic, difficulty, COUNT(*) as question_count
       FROM questions
       GROUP BY subject, topic, subtopic, difficulty
       ORDER BY subject, topic, subtopic, difficulty`
    );

    const tree = {};
    for (const row of result.rows) {
      if (!tree[row.subject]) {
        tree[row.subject] = { subject: row.subject, topics: {} };
      }
      if (!tree[row.subject].topics[row.topic]) {
        tree[row.subject].topics[row.topic] = { topic: row.topic, subtopics: {} };
      }
      if (!tree[row.subject].topics[row.topic].subtopics[row.subtopic]) {
        tree[row.subject].topics[row.topic].subtopics[row.subtopic] = {
          subtopic: row.subtopic,
          total: 0,
          by_difficulty: {}
        };
      }
      tree[row.subject].topics[row.topic].subtopics[row.subtopic].total += row.question_count;
      tree[row.subject].topics[row.topic].subtopics[row.subtopic].by_difficulty[row.difficulty] = row.question_count;
    }

    // Flatten into arrays
    const result_arr = Object.values(tree).map(s => ({
      ...s,
      topics: Object.values(s.topics).map(t => ({
        ...t,
        subtopics: Object.values(t.subtopics)
      }))
    }));

    res.json(result_arr);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
};

module.exports = { getQuestions, getAdminQuestions, getQuestionStats, getQuestionById, createQuestion, updateQuestion, deleteQuestion, getSubjects };
