// Fills answers/explanations into the scraped draft and emits upload-ready CSV.
const fs = require('fs');
const path = require('path');

const draft = require('./pyqs_draft.json');

// keyed by 0-based index into draft (Q1..Q13)
const ANSWERS = {
  // Q6 (English, correct sentences)
  5: {
    correct: 'd',
    explanation: 'Sentence (I) and (II) are grammatically correct. Sentence (III) "Each of the students were required" is wrong because "Each" takes a singular verb; it should be "was required". Hence (I) and (II) are correct.'
  },
  // Q7 (English, incorrect sentences)
  6: {
    correct: 'd',
    explanation: 'Sentences (I) and (II) are incorrect. (I) "along with her team" is parenthetical, so the subject is "The manager" (singular) and it should be "was discussing". (II) should be "If I had known" (past perfect), not "would have known". (III) is correct. Hence (I) and (II) are incorrect.'
  },
  // Q8 (English, correct sentences)
  7: {
    correct: 'b',
    explanation: 'Sentence (I) should be "If you had studied" (past perfect), so it is incorrect. Sentences (II) and (III) are grammatically correct. Hence (II) and (III) are correct.'
  },
  // Q9 DI
  8: {
    correct: 'b',
    explanation: 'Bikes sold by Y in K = 210. Cars sold by Y in K = (2/5) x 210 = 84. Cars sold by X in K = 450 - 84 = 366. Bikes sold by X in M = 440 - 90 = 350. Required difference = 366 - 350 = 16.'
  },
  // Q10 DI
  9: {
    correct: 'e',
    explanation: 'Bikes sold by X in M = 440 - 90 = 350. Cars sold by X in N = 80% of 350 = 280. Cars sold by Y in N = 350 - 280 = 70. Required ratio = 70 : 210 = 1 : 3.'
  },
  // Q11 DI
  10: {
    correct: 'a',
    explanation: 'Cars (X + Y) in L = 980, split 3 : 4, so Cars X in L = (3/7) x 980 = 420 and Cars Y in L = 560. Bikes sold by Y in N = 195. 420 - 195 = 225, so cars sold by X in L is 225 more.'
  },
  // Q12 DI
  11: {
    correct: 'b',
    explanation: 'Bikes sold by X in M = 440 - 90 = 350. Cars (X + Y) together in N = 350. Percentage change = (350 - 350)/350 x 100 = 0%.'
  },
  // Q13 DI
  12: {
    correct: 'a',
    explanation: 'Bikes sold by X in L = 560 - 320 = 240. Cars sold by Y in M = 240 + 200 = 440. Cars sold by X in M = 730 - 440 = 290. Cars (X + Y) in K = 450. Required percentage = 290/450 x 100 = 64.4% = 64% (approx).'
  }
};

const upload = [];
const review = [];
draft.forEach((q, i) => {
  const a = ANSWERS[i];
  const rec = { ...q };
  if (a) {
    rec.correct_option = a.correct;
    rec.explanation = a.explanation;
    upload.push(rec);
  } else {
    rec.explanation = 'NEEDS REVIEW: memory-based seating clues are internally inconsistent; verify against official answer key before publishing.';
    review.push(rec);
  }
});

function toCsv(rows) {
  const headers = ['subject', 'topic', 'subtopic', 'difficulty', 'question_text',
    'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
    'correct_option', 'explanation', 'exam_stage', 'tags'];
  const esc = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'pyqs_upload.csv'), toCsv(upload));
fs.writeFileSync(path.join(outDir, 'pyqs_needs_review.csv'), toCsv(review));
fs.writeFileSync(path.join(outDir, 'pyqs_upload.json'), JSON.stringify(upload, null, 2));
console.log(`Ready to upload: ${upload.length} questions -> tools/pyqs_upload.csv`);
console.log(`Needs review:    ${review.length} questions -> tools/pyqs_needs_review.csv`);
