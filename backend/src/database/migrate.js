const fs = require('fs');
const path = require('path');
const { db } = require('./db');

function migrate() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running database migrations...');

    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    db.exec('BEGIN TRANSACTION');
    try {
      for (const stmt of statements) {
        db.exec(stmt + ';');
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Additive ALTER TABLE migrations — safe to run repeatedly (wrapped in try/catch each)
    const alterations = [
      `ALTER TABLE tests ADD COLUMN sections TEXT DEFAULT NULL`,
      `ALTER TABLE tests ADD COLUMN exam_mode INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE attempts ADD COLUMN exam_mode INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE questions ADD COLUMN set_id INTEGER REFERENCES question_sets(id)`,
      `ALTER TABLE student_topic_mastery ADD COLUMN raw_score REAL DEFAULT 0`,
      `ALTER TABLE student_topic_mastery ADD COLUMN last_result INTEGER`,
      `ALTER TABLE student_topic_mastery ADD COLUMN current_streak INTEGER DEFAULT 0`,
      `ALTER TABLE student_topic_mastery ADD COLUMN peak_score REAL DEFAULT 0`,
      `ALTER TABLE student_topic_mastery ADD COLUMN time_samples INTEGER DEFAULT 0`,
      `ALTER TABLE student_topic_mastery ADD COLUMN difficulty_accuracy TEXT DEFAULT '{}'`,
      `ALTER TABLE student_topic_mastery ADD COLUMN stage_accuracy TEXT DEFAULT '{}'`,
      `ALTER TABLE student_topic_mastery ADD COLUMN last_attempt_at TEXT`,
    ];

    for (const sql of alterations) {
      try {
        db.prepare(sql).run();
        console.log(`  Applied: ${sql.slice(0, 60)}...`);
      } catch (e) {
        // Column already exists — expected on re-runs, ignore
        if (!e.message.includes('duplicate column name')) {
          throw e;
        }
      }
    }

    // Rebuild questions table to support a 5th option (option_e) and correct_option 'e'
    const qCols = db.prepare('PRAGMA table_info(questions)').all();
    const hasOptionE = qCols.some(c => c.name === 'option_e');
    const qDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'").get();
    const checkHasE = qDef && /correct_option IN \('a','b','c','d','e'\)/.test(qDef.sql);
    if (!hasOptionE || !checkHasE) {
      console.log('  Rebuilding questions table for 5-option support...');
      db.pragma('foreign_keys = OFF');
      db.exec(`
        BEGIN TRANSACTION;
        DROP TABLE IF EXISTS questions_new;
        CREATE TABLE questions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject TEXT NOT NULL,
          topic TEXT NOT NULL,
          subtopic TEXT,
          difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
          question_text TEXT NOT NULL,
          option_a TEXT NOT NULL,
          option_b TEXT NOT NULL,
          option_c TEXT NOT NULL,
          option_d TEXT NOT NULL,
          option_e TEXT,
          correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd', 'e')),
          explanation TEXT,
          exam_stage TEXT NOT NULL CHECK (exam_stage IN ('prelims', 'mains')),
          tags TEXT,
          set_id INTEGER REFERENCES question_sets(id),
          created_by INTEGER REFERENCES users(id),
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO questions_new (id, subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, exam_stage, tags, set_id, created_by, created_at)
          SELECT id, subject, topic, subtopic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, exam_stage, tags, set_id, created_by, created_at FROM questions;
        DROP TABLE questions;
        ALTER TABLE questions_new RENAME TO questions;
        CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON questions(subject, topic);
        COMMIT;
      `);
      db.pragma('foreign_keys = ON');
      const fkViolations = db.pragma('foreign_key_check');
      if (fkViolations.length > 0) {
        console.error('  Foreign key violations after rebuild:', fkViolations);
      }
      console.log('  questions table rebuilt.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
