const XLSX = require('xlsx');
const pool = require('../database/db');

const VALID_DIFFICULTY = ['easy', 'medium', 'hard'];
const VALID_STAGE = ['prelims', 'mains'];
const VALID_CORRECT = ['a', 'b', 'c', 'd', 'e'];
const VALID_SET_TYPE = ['di', 'rc', 'puzzle', 'cloze', 'group', 'other'];

const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const COLUMN_ALIASES = {
  subject: ['subject', 'subjectname'],
  topic: ['topic', 'topicname'],
  subtopic: ['subtopic', 'subtopics'],
  difficulty: ['difficulty', 'level'],
  questiontext: ['questiontext', 'question', 'text', 'qs'],
  optiona: ['optiona', 'option1', 'opt1', 'choicea'],
  optionb: ['optionb', 'option2', 'opt2', 'choiceb'],
  optionc: ['optionc', 'option3', 'opt3', 'choicec'],
  optiond: ['optiond', 'option4', 'opt4', 'choiced'],
  optione: ['optione', 'option5', 'opt5', 'choicee'],
  correctoption: ['correctoption', 'correct', 'answer', 'rightanswer', 'ans'],
  explanation: ['explanation', 'explain', 'solution', 'sol'],
  examstage: ['examstage', 'stage', 'exammode'],
  tags: ['tags', 'tag'],
  settitle: ['settitle', 'set', 'setname', 'groupset'],
  settype: ['settype', 'setcategory'],
  setstimulus: ['setstimulus', 'stimulus', 'passage', 'table', 'clues', 'instructions'],
  setsource: ['setsource', 'source'],
};

const OPTIONAL_COLUMNS = ['settitle', 'settype', 'setstimulus', 'setsource'];

const TEMPLATE_HEADERS = [
  'subject', 'topic', 'subtopic', 'difficulty', 'question_text',
  'option_a', 'option_b', 'option_c', 'option_d',
  'option_e', 'correct_option', 'explanation', 'exam_stage', 'tags',
  'set_title', 'set_type', 'set_stimulus', 'set_source'
];

const TEMPLATE_ROW = [
  'Reasoning', 'Seating Arrangement', 'Linear Arrangement', 'medium',
  'Example question text goes here...',
  'Option A', 'Option B', 'Option C', 'Option D', 'Option E (optional)',
  'a', 'Explanation for the correct answer (optional)', 'prelims', 'tag1,tag2',
  '', '', '', ''
];

const buildColumnMap = (headers) => {
  const map = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = headers.find(h => aliases.includes(normalizeHeader(h)));
    if (match !== undefined) map[key] = match;
  }
  return map;
};

const parseCell = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const uploadQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Uploaded file contains no sheets' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No rows found in the file' });
    }

    const headers = Object.keys(rows[0]);
    const col = buildColumnMap(headers);
    const missing = Object.keys(COLUMN_ALIASES).filter(k => !col[k] && !OPTIONAL_COLUMNS.includes(k));
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missing.join(', ')}`,
        expected: TEMPLATE_HEADERS.join(', ')
      });
    }

    const setCache = new Map();
    let inserted = 0;
    const errors = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;
        const rec = {
          subject: parseCell(row[col.subject]),
          topic: parseCell(row[col.topic]),
          subtopic: parseCell(row[col.subtopic]),
          difficulty: parseCell(row[col.difficulty]).toLowerCase(),
          question_text: parseCell(row[col.questiontext]),
          option_a: parseCell(row[col.optiona]),
          option_b: parseCell(row[col.optionb]),
          option_c: parseCell(row[col.optionc]),
          option_d: parseCell(row[col.optiond]),
          option_e: parseCell(row[col.optione]),
          correct_option: parseCell(row[col.correctoption]).toLowerCase(),
          explanation: parseCell(row[col.explanation]),
          exam_stage: parseCell(row[col.examstage]).toLowerCase(),
          tags: parseCell(row[col.tags]),
          set_title: col.settitle ? parseCell(row[col.settitle]) : '',
          set_type: col.settype ? parseCell(row[col.settype]).toLowerCase() : '',
          set_stimulus: col.setstimulus ? parseCell(row[col.setstimulus]) : '',
          set_source: col.setsource ? parseCell(row[col.setsource]) : ''
        };

        const problems = [];
        if (!rec.subject) problems.push('subject is empty');
        if (!rec.topic) problems.push('topic is empty');
        if (!rec.question_text) problems.push('question_text is empty');
        if (!rec.option_a || !rec.option_b || !rec.option_c || !rec.option_d) problems.push('options a, b, c and d are required');
        if (!VALID_DIFFICULTY.includes(rec.difficulty)) problems.push(`difficulty must be one of: ${VALID_DIFFICULTY.join('/')}`);
        if (!VALID_CORRECT.includes(rec.correct_option)) problems.push(`correct_option must be one of: ${VALID_CORRECT.join('/')}`);
        if (!VALID_STAGE.includes(rec.exam_stage)) problems.push(`exam_stage must be one of: ${VALID_STAGE.join('/')}`);
        if (rec.set_type && !VALID_SET_TYPE.includes(rec.set_type)) problems.push(`set_type must be one of: ${VALID_SET_TYPE.join('/')}`);

        if (problems.length > 0) {
          errors.push({ row: rowNumber, error: problems.join('; ') });
          continue;
        }

        let setId = null;
        if (rec.set_title) {
          const setKey = `${rec.set_title} ||| ${rec.set_stimulus || rec.set_title}`;
          if (setCache.has(setKey)) {
            setId = setCache.get(setKey);
          } else {
            const setType = rec.set_type || 'group';
            const info = await client.query(
              `INSERT INTO question_sets (set_type, title, stimulus, source)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [setType, rec.set_title, rec.set_stimulus || rec.set_title, rec.set_source || null]
            );
            setId = Number(info.rows[0].id);
            setCache.set(setKey, setId);
          }
        }

        await client.query(
          `INSERT INTO questions
             (subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, exam_stage, tags, set_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            rec.subject, rec.topic, rec.subtopic, rec.difficulty, rec.question_text,
            rec.option_a, rec.option_b, rec.option_c, rec.option_d, rec.option_e, rec.correct_option,
            rec.explanation, rec.exam_stage,
            rec.tags ? JSON.stringify(rec.tags.split(',').map(t => t.trim()).filter(Boolean)) : '[]',
            setId, req.user.id
          ]
        );
        inserted++;
      }
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (e) { /* no active transaction */ }
      throw error;
    } finally {
      client.release();
    }

    res.json({ inserted, total: rows.length, errors, sets_created: setCache.size });
  } catch (error) {
    console.error('Upload questions error:', error);
    res.status(500).json({ error: 'Failed to upload questions' });
  }
};

const downloadTemplate = (req, res) => {
  try {
    const aoa = [TEMPLATE_HEADERS, TEMPLATE_ROW];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question_template.xlsx"');
    res.send(buf);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
};

module.exports = { uploadQuestions, downloadTemplate };
