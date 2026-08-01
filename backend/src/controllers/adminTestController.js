const pool = require('../database/db');

const DEFAULT_DURATION = { full_mock: 60, sectional: 20, topic_practice: 15 };

const buildAvailabilityQuery = (filters) => {
  let where = 'WHERE 1=1';
  const params = [];
  if (filters.subject) { where += ' AND subject = ?'; params.push(filters.subject); }
  if (filters.topic) { where += ' AND topic = ?'; params.push(filters.topic); }
  if (filters.subtopic) { where += ' AND subtopic = ?'; params.push(filters.subtopic); }
  if (filters.difficulty) { where += ' AND difficulty = ?'; params.push(filters.difficulty); }
  return { where, params };
};

const generateTest = async (req, res) => {
  try {
    const {
      title,
      type = 'sectional',
      exam_stage = 'prelims',
      duration_minutes,
      negative_marking_ratio = 0.25,
      sections
    } = req.body;

    if (!['full_mock', 'sectional', 'topic_practice'].includes(type)) {
      return res.status(400).json({ error: 'type must be full_mock, sectional, or topic_practice' });
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'sections must be a non-empty array' });
    }

    const questionIds = [];
    const sectionSummary = [];

    for (const s of sections) {
      if (!s.subject) return res.status(400).json({ error: 'Each section requires a subject' });
      const count = parseInt(s.count, 10);
      if (!Number.isInteger(count) || count < 1 || count > 200) {
        return res.status(400).json({ error: `Section "${s.subject}" requires a count between 1 and 200` });
      }

      const { where, params } = buildAvailabilityQuery({
        subject: s.subject, topic: s.topic, subtopic: s.subtopic, difficulty: s.difficulty
      });

      const availResult = await pool.query(`SELECT COUNT(*) AS c FROM questions ${where}`, params);
      const available = availResult.rows[0].c;
      const take = Math.min(count, available);

      if (take === 0) {
        return res.status(400).json({
          error: `No questions found for ${[s.subject, s.topic, s.difficulty].filter(Boolean).join(' / ')}`
        });
      }

      const rows = await pool.query(
        `SELECT id FROM questions ${where} ORDER BY RANDOM() LIMIT ?`,
        [...params, take]
      );

      questionIds.push(...rows.rows.map(r => r.id));
      sectionSummary.push({ subject: s.subject, topic: s.topic || null, requested: count, available, used: take });
    }

    const finalIds = [...new Set(questionIds)];

    const finalTitle = title || `${type === 'full_mock' ? 'Full Mock' : type === 'sectional' ? 'Sectional' : 'Topic Practice'} — ${sectionSummary.map(s => s.subject).join(' + ')} (${new Date().toLocaleDateString()})`;
    const finalDuration = duration_minutes || DEFAULT_DURATION[type];

    const result = await pool.query(
      `INSERT INTO tests (title, type, exam_stage, duration_minutes, negative_marking_ratio, question_ids)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [finalTitle, type, exam_stage, finalDuration, negative_marking_ratio, JSON.stringify(finalIds)]
    );

    res.status(201).json({
      test: result.rows[0],
      question_count: finalIds.length,
      sections: sectionSummary
    });
  } catch (error) {
    console.error('Generate test error:', error);
    res.status(500).json({ error: 'Failed to generate test' });
  }
};

module.exports = { generateTest };
