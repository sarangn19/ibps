#!/usr/bin/env node
/**
 * Shared helpers for fact-based deterministic generators (computer, GA).
 * Every correct answer is hard-curated or computed — never guessed.
 */
const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'backend', 'node_modules', 'xlsx'));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Build a 4-option MCQ. correct + up to 3 unique distractors.
function buildQ(rng, { subject, topic, subtopic, difficulty, question_text, correct, distractors, explanation, exam_stage, tags }) {
  const correctStr = String(correct);
  const seen = new Set([correctStr]);
  const opts = [correctStr];
  for (const d of distractors || []) {
    const s = String(d);
    if (s && s !== '' && !seen.has(s)) { opts.push(s); seen.add(s); }
    if (opts.length >= 4) break;
  }
  // Pad if too few distractors supplied (shouldn't normally happen)
  let i = 1;
  while (opts.length < 4) {
    const filler = `None of these ${i}`;
    if (!seen.has(filler)) { opts.push(filler); seen.add(filler); }
    i++;
  }
  const ordered = shuffle(rng, opts);
  const correctLetter = ['a', 'b', 'c', 'd'][ordered.indexOf(correctStr)];
  const q = {
    subject, topic, subtopic, difficulty, question_text,
    option_a: ordered[0], option_b: ordered[1], option_c: ordered[2], option_d: ordered[3],
    option_e: '', correct_option: correctLetter,
    explanation: explanation || '', exam_stage, tags
  };
  return q;
}

// Extract the value of a key from every item in a pool
const allValues = (pool, key) => pool.map(x => x[key]).filter(Boolean);

// Verify: every option present, exactly 4 unique options, correct letter matches.
function verify(rows) {
  let bad = 0;
  for (const r of rows) {
    const key = `option_${r.correct_option}`;
    if (!r[key] || r[key].trim() === '') { bad++; console.error('MISSING correct value:', r.question_text); }
    const vals = [r.option_a, r.option_b, r.option_c, r.option_d].filter(v => v && v.trim() !== '');
    if (vals.length !== 4 || new Set(vals).size !== 4) { bad++; console.error('Duplicate/empty option:', r.question_text, vals); }
  }
  console.log(`Verification: ${rows.length - bad}/${rows.length} clean`);
}

// Emit upload-ready CSV + xlsx + summary
function emit(rows, summary, name) {
  const headers = ['subject', 'topic', 'subtopic', 'difficulty', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct_option', 'explanation', 'exam_stage', 'tags', 'set_title', 'set_type', 'set_stimulus', 'set_source'];
  const csvLines = [headers.join(',')];
  const aoa = [headers];
  for (const r of rows) {
    const rec = {
      subject: r.subject, topic: r.topic, subtopic: r.subtopic || '', difficulty: r.difficulty,
      question_text: r.question_text.replace(/[\r\n]+/g, ' | '),
      option_a: r.option_a, option_b: r.option_b, option_c: r.option_c, option_d: r.option_d,
      option_e: r.option_e || '', correct_option: r.correct_option,
      explanation: r.explanation.replace(/[\r\n]+/g, ' | '), exam_stage: r.exam_stage,
      tags: (r.tags || []).join(','), set_title: '', set_type: '', set_stimulus: '', set_source: ''
    };
    const escape = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    csvLines.push(headers.map(h => escape(rec[h])).join(','));
    aoa.push(headers.map(h => rec[h]));
  }
  const outDir = path.join(__dirname);
  fs.writeFileSync(path.join(outDir, `${name}_upload.csv`), '\uFEFF' + csvLines.join('\n'), 'utf8');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, path.join(outDir, `${name}_upload.xlsx`));
  fs.writeFileSync(path.join(outDir, `${name}_summary.json`), JSON.stringify(summary, null, 2));
  console.log(`Wrote ${name}_upload.csv, ${name}_upload.xlsx, ${name}_summary.json`);
}

const argValue = (name, dflt) => {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] !== undefined) return process.argv[idx + 1];
  return dflt;
};

// Normalize a question text to a stable dedupe key (case/whitespace/punct-insensitive).
const normText = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Load normalized question texts already present in the live DB for a subject,
// so re-running a generator never re-emits an existing question.
function loadExistingTexts(subject) {
  const db = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'))(path.join(__dirname, '..', 'backend', 'data', 'ibps.db'));
  const rows = db.prepare('SELECT question_text FROM questions WHERE subject = ?').all(subject);
  db.close();
  return new Set(rows.map(r => normText(r.question_text)));
}

module.exports = { mulberry32, rand, pick, shuffle, buildQ, allValues, verify, emit, argValue, normText, loadExistingTexts };
