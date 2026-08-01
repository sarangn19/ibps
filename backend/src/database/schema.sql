PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_type TEXT NOT NULL CHECK (set_type IN ('di', 'rc', 'puzzle', 'cloze', 'group', 'other')),
  title TEXT NOT NULL,
  stimulus TEXT NOT NULL,
  source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  batch_id INTEGER REFERENCES batches(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
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

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sectional', 'full_mock', 'topic_practice')),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('prelims', 'mains')),
  duration_minutes INTEGER NOT NULL,
  negative_marking_ratio REAL DEFAULT 0.25,
  batch_id INTEGER REFERENCES batches(id),
  question_ids TEXT NOT NULL,
  -- sections: JSON array of {name, question_ids[], time_limit_minutes}
  -- null means no sectional timing (single global timer)
  sections TEXT DEFAULT NULL,
  -- exam_mode: 1 = hide answers until fully submitted, block navigate-away
  exam_mode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  test_id INTEGER NOT NULL REFERENCES tests(id),
  started_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT,
  total_score REAL,
  section_scores TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  exam_mode INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  selected_option TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER,
  marked_for_review INTEGER DEFAULT 0,
  error_tag TEXT CHECK (error_tag IN ('concept_gap', 'silly_mistake', 'guessed', 'time_out')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  metadata TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_topic_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  mastery_score REAL DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  raw_score REAL DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  accuracy_rolling REAL DEFAULT 0,
  avg_time_vs_expected REAL,
  error_type_breakdown TEXT,
  classification TEXT DEFAULT 'not_attempted' CHECK (classification IN ('weak', 'developing', 'strong', 'not_attempted')),
  last_result INTEGER,
  current_streak INTEGER DEFAULT 0,
  peak_score REAL DEFAULT 0,
  time_samples INTEGER DEFAULT 0,
  difficulty_accuracy TEXT DEFAULT '{}',
  stage_accuracy TEXT DEFAULT '{}',
  last_attempt_at TEXT,
  last_updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, subject, topic, subtopic)
);

CREATE TABLE IF NOT EXISTS mastery_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  mastery_score REAL DEFAULT 0,
  raw_score REAL DEFAULT 0,
  classification TEXT,
  attempt_count INTEGER DEFAULT 0,
  accuracy_rolling REAL DEFAULT 0,
  avg_time_vs_expected REAL,
  error_type_breakdown TEXT,
  difficulty_accuracy TEXT DEFAULT '{}',
  snapshot_type TEXT DEFAULT 'attempt',
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mastery_history_user_key ON mastery_history(user_id, subject, topic, subtopic, timestamp);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_question_responses_attempt_id ON question_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_responses_question_id ON question_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_topic_mastery_user_id ON student_topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON questions(subject, topic);
