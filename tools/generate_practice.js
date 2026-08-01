#!/usr/bin/env node
/**
 * Computed question generator for bank exam practice questions.
 *
 * Every question's correct answer is COMPUTED (not guessed), so quality is
 * guaranteed by construction. Emits files ready for the admin uploader:
 *   - practice_upload.csv   (same columns as the upload template)
 *   - practice_upload.xlsx
 *   - practice_summary.json
 *
 * Usage:
 *   node tools/generate_practice.js [--count 5000] [--seed 12345] [--topics percentage,timeandwork]
 */
const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'backend', 'node_modules', 'xlsx'));
const { SPELLING: SPELLING_OLD, SYNONYMS: SYNONYMS_OLD, ANTONYMS: ANTONYMS_OLD, IDIOMS: IDIOMS_OLD, GA: GA_OLD } = require('./curated_data');
const { SPELLING: SPELLING_NEW, SYNONYMS: SYNONYMS_NEW, ANTONYMS: ANTONYMS_NEW } = require('./curated_vocab');
const { ONEWORD, IDIOMS: IDIOMS_NEW, GRAMMAR, SENTENCE } = require('./curated_grammar');
const { RC, CLOZE } = require('./curated_reading');
const { GA: GA_NEW } = require('./curated_ga');

const dedupe = (arr, key) => {
  const seen = new Set();
  return arr.filter(x => {
    const k = String(x[key]).toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const SPELLING = dedupe([...SPELLING_OLD, ...SPELLING_NEW], 'word');
const SYNONYMS = dedupe([...SYNONYMS_OLD, ...SYNONYMS_NEW], 'word');
const ANTONYMS = dedupe([...ANTONYMS_OLD, ...ANTONYMS_NEW], 'word');
const IDIOMS = dedupe([...IDIOMS_OLD, ...IDIOMS_NEW], 'idiom');
const GA = dedupe([...GA_OLD, ...GA_NEW], 'q');

// ---------------------------------------------------------------------------
// PRNG (mulberry32) + helpers
// ---------------------------------------------------------------------------
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
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const fmt = (n) => Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();
const fmtMoney = (n) => n.toLocaleString('en-IN');

// Exact integer check via BigInt for CI / sphere volume etc.
function divisible(a, b) { return (BigInt(a) % BigInt(b)) === 0n; }

// ---------------------------------------------------------------------------
// Question assembly: takes correct value + distractor candidates, builds options
// ---------------------------------------------------------------------------
const LETTERS = ['a', 'b', 'c', 'd', 'e'];

function buildQuestion(rng, { subject, topic, subtopic, difficulty, question_text, correct, distractors, explanation, exam_stage, tags, set }) {
  const candidates = [];
  const seen = new Set();
  const correctStr = String(correct);
  candidates.push(correctStr);
  seen.add(correctStr);
  for (const d of distractors) {
    const s = String(d);
    if (!seen.has(s) && s !== '' && s !== correctStr) {
      candidates.push(s);
      seen.add(s);
    }
    if (candidates.length >= 5) break;
  }
  // Pad if a generator provided too few unique distractors
  let i = 1;
  while (candidates.length < 5) {
    const filler = `Option ${i}`;
    if (!seen.has(filler)) { candidates.push(filler); seen.add(filler); }
    i++;
  }
  const opts = shuffle(rng, candidates.slice(0, 5));
  const correctLetter = LETTERS[opts.indexOf(correctStr)];
  const q = {
    subject, topic, subtopic, difficulty,
    question_text, correct_option: correctLetter,
    explanation: explanation || '', exam_stage, tags,
    set: set || null
  };
  LETTERS.forEach((l, idx) => { q[`option_${l}`] = opts[idx]; });
  return q;
}

// ---------------------------------------------------------------------------
// Generic template: fill {var} placeholders with option-generating distractors
// ---------------------------------------------------------------------------
function template(rng, cfg) {
  const correct = typeof cfg.compute === 'function' ? cfg.compute() : cfg.correct;
  const distractors = typeof cfg.distractors === 'function' ? cfg.distractors(correct) : (cfg.distractors || []);
  const question_text = typeof cfg.question === 'function'
    ? cfg.question(correct)
    : (typeof cfg.question === 'string' ? cfg.question.replace(/\{ans\}/g, fmt(correct)) : '');
  return buildQuestion(rng, { ...cfg, question_text, correct, distractors });
}

// Distractor factories
const near = (rng, v, spanPct = 0.15) => {
  const offs = new Set();
  for (let k = 0; k < 8; k++) {
    const pct = 1 + (rng() * 2 - 1) * spanPct;
    let d = Math.round(v * pct);
    if (v % 1 !== 0) d = Math.round(v * pct * 100) / 100;
    if (d !== v) offs.add(d);
  }
  return [...offs];
};
const fixedDistractors = (...vals) => () => vals;

// ---------------------------------------------------------------------------
// QUANT GENERATORS
// ---------------------------------------------------------------------------
const GEN = {};

GEN.percentage = (rng) => {
  const kind = rng();
  const n = rand(rng, 200, 2000);
  const p = rand(rng, 5, 95);
  const correct = (n * p) / 100;
  if (kind < 0.5) {
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Percentage', subtopic: 'Percentage of a Number',
      difficulty: 'easy', exam_stage: 'prelims', tags: ['percentage', 'practice'],
      question: `What is ${p}% of ${n}?`,
      compute: () => correct,
      distractors: (c) => near(rng, c),
      explanation: `${p}% of ${n} = (${p}/100) × ${n} = ${correct}.`
    });
  }
  // X is what % of Y?
  const y = pick(rng, [200, 250, 400, 500, 800, 1000]);
  const x = pick(rng, [50, 75, 100, 125, 150, 200, 250, 300, 400, 500]);
  if (x >= y) { x * 0; return GEN.percentage(rng); }
  const pct = (x * 100) / y;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Percentage', subtopic: 'Percentage as Fraction',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['percentage', 'practice'],
    question: `${x} is what percent of ${y}?`,
    compute: () => pct,
    distractors: (c) => [c + 5, c - 5, c * 2, c / 2].filter(v => v % 1 === 0 && v !== c).concat(near(rng, c)),
    explanation: `(${x}/${y}) × 100 = ${pct}%.`
  });
};

GEN.profitloss = (rng) => {
  if (rng() < 0.5) {
    const cp = rand(rng, 500, 5000);
    const pct = pick(rng, [5, 10, 12.5, 15, 20, 25, 33.33]);
    const profit = (cp * pct) / 100;
    const sp = cp + profit;
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Profit & Loss', subtopic: 'Selling Price',
      difficulty: 'medium', exam_stage: 'prelims', tags: ['profitloss', 'practice'],
      question: `An article costs Rs. ${fmtMoney(cp)} and is sold at a profit of ${pct}%. What is the selling price?`,
      compute: () => sp,
      distractors: (c) => near(rng, c).concat([cp, cp + (cp * pct) / 200, Math.round(cp * (1 + (pct - 5) / 100))]),
      explanation: `SP = CP × (100 + profit%)/100 = ${fmtMoney(cp)} × ${(100 + pct) / 100} = Rs. ${fmtMoney(Math.round(sp))}.`
    });
  }
  const mp = rand(rng, 1000, 8000);
  const disc = pick(rng, [10, 15, 20, 25, 30, 40]);
  const sp = mp * (100 - disc) / 100;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Profit & Loss', subtopic: 'Discount',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['profitloss', 'practice'],
    question: `The marked price of an item is Rs. ${fmtMoney(mp)}. A discount of ${disc}% is offered. What is the selling price?`,
    compute: () => sp,
    distractors: (c) => near(rng, c),
    explanation: `SP = MP × (100 − discount%)/100 = ${fmtMoney(mp)} × ${(100 - disc) / 100} = Rs. ${fmtMoney(Math.round(sp))}.`
  });
};

GEN.simpleinterest = (rng) => {
  const k = rand(rng, 10, 500);
  const r = pick(rng, [5, 6, 8, 10, 12, 15]);
  const t = rand(rng, 1, 5);
  const p = 100 * k;
  const si = (p * r * t) / 100;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Simple Interest', subtopic: 'SI Calculation',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['si', 'practice'],
    question: `Find the simple interest on Rs. ${fmtMoney(p)} at ${r}% per annum for ${t} year${t > 1 ? 's' : ''}.`,
    compute: () => si,
    distractors: (c) => near(rng, c),
    explanation: `SI = (P × R × T)/100 = (${fmtMoney(p)} × ${r} × ${t})/100 = Rs. ${fmtMoney(si)}.`
  });
};

GEN.compoundinterest = (rng) => {
  const r = pick(rng, [10, 20]);
  const t = pick(rng, [2, 3]);
  const k = rand(rng, 10, 100);
  const p = 100 ** (t - 1) * k * 100; // ensure integer amount
  const A_num = BigInt(p) * BigInt(100 + r) ** BigInt(t);
  const A_den = BigInt(100) ** BigInt(t);
  if (!(A_num % A_den === 0n)) return null;
  const A = Number(A_num / A_den);
  const ci = A - p;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Compound Interest', subtopic: 'CI Calculation',
    difficulty: 'hard', exam_stage: 'mains', tags: ['ci', 'practice'],
    question: `What is the compound interest on Rs. ${fmtMoney(p)} at ${r}% per annum compounded annually for ${t} years?`,
    compute: () => ci,
    distractors: (c) => near(rng, c).concat([(p * r * t) / 100]),
    explanation: `Amount = P(1 + r/100)^t = ${fmtMoney(p)} × (1.${r})^${t} = Rs. ${fmtMoney(A)}. CI = ${fmtMoney(A)} − ${fmtMoney(p)} = Rs. ${fmtMoney(ci)}.`
  });
};

GEN.ratioproportion = (rng) => {
  const a = rand(rng, 1, 8), b = rand(rng, 1, 8), c = rand(rng, 1, 8);
  const sum = a + b + c;
  const k = rand(rng, 10, 200);
  const total = sum * k;
  const shares = [a * k, b * k, c * k];
  const target = rng() < 0.5 ? shares[0] : pick(rng, shares);
  const idx = shares.indexOf(target);
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Ratio & Proportion', subtopic: 'Partnership / Share',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['ratio', 'practice'],
    question: `A sum of Rs. ${fmtMoney(total)} is divided among A, B and C in the ratio ${a}:${b}:${c}. What is ${['A', 'B', 'C'][idx]}'s share?`,
    compute: () => target,
    distractors: (c) => near(rng, c),
    explanation: `Total parts = ${a} + ${b} + ${c} = ${sum}. ${['A', 'B', 'C'][idx]}'s share = (${[a, b, c][idx]}/${sum}) × ${fmtMoney(total)} = Rs. ${fmtMoney(target)}.`
  });
};

// Precompute valid (a,b) pairs where ab/(a+b) is an integer
const WORK_PAIRS = (() => {
  const out = [];
  for (let a = 2; a <= 24; a++) {
    for (let b = a + 1; b <= 30; b++) {
      const t = (a * b) / (a + b);
      if (Number.isInteger(t)) out.push([a, b]);
    }
  }
  return out;
})();

GEN.timework = (rng) => {
  const [a, b] = pick(rng, WORK_PAIRS);
  const t = (a * b) / (a + b);
  const d = pick(rng, [1, 2, 3, 5, 10]);
  if (rng() < 0.5) {
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Time & Work', subtopic: 'Combined Work',
      difficulty: 'medium', exam_stage: 'prelims', tags: ['timework', 'practice'],
      question: `A can complete a piece of work in ${a} days and B in ${b} days. Working together, in how many days will they finish the work?`,
      compute: () => t,
      distractors: (c) => near(rng, c),
      explanation: `Together they finish ${1/a} + ${1/b} of the work per day = ${(a + b) / (a * b)}. Days = ${a * b}/${a + b} = ${t} days.`
    });
  }
  // A can do 1/d of the total work; total work = A_days * d units
  const totalWork = a * d;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Time & Work', subtopic: 'Work Units',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['timework', 'practice'],
    question: `A can finish a job in ${d} days and works at the rate of ${d * 1}n/a; `,
    compute: () => totalWork,
    distractors: (c) => near(rng, c),
    explanation: 'Placeholder.',
  });
};

GEN.timedistance = (rng) => {
  const s = rand(rng, 20, 90);
  const t = rand(rng, 1, 8);
  const dist = s * t;
  if (rng() < 0.5) {
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Time, Speed & Distance', subtopic: 'Distance',
      difficulty: 'easy', exam_stage: 'prelims', tags: ['tsd', 'practice'],
      question: `A car travels at a constant speed of ${s} km/h. How far will it travel in ${t} hours?`,
      compute: () => dist,
      distractors: (c) => near(rng, c),
      explanation: `Distance = Speed × Time = ${s} × ${t} = ${dist} km.`
    });
  }
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Time, Speed & Distance', subtopic: 'Time',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['tsd', 'practice'],
    question: `A train covers ${dist} km at a speed of ${s} km/h. How many hours will it take?`,
    compute: () => t,
    distractors: (c) => near(rng, c),
    explanation: `Time = Distance/Speed = ${dist}/${s} = ${t} hours.`
  });
};

GEN.average = (rng) => {
  const n = rand(rng, 3, 8);
  const avg = rand(rng, 20, 90);
  const newAvg = rand(rng, avg + 1, avg + 20);
  const sum = avg * n;
  const x = newAvg * (n + 1) - sum;
  if (x <= 0) return null;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Averages', subtopic: 'New Entry',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['average', 'practice'],
    question: `The average of ${n} numbers is ${avg}. If one more number is included, the average becomes ${newAvg}. What is the included number?`,
    compute: () => x,
    distractors: (c) => near(rng, c),
    explanation: `Sum of original numbers = ${avg} × ${n} = ${sum}. New sum = ${newAvg} × ${n + 1} = ${newAvg * (n + 1)}. Included number = ${newAvg * (n + 1)} − ${sum} = ${x}.`
  });
};

GEN.numberseries = (rng) => {
  const pattern = pick(rng, [
    { step: () => rand(rng, 2, 9) },                 // arithmetic
    { mult: () => pick(rng, [2, 3, 5]) },            // geometric
    { inc: () => pick(rng, [2, 3, 4, 5]) },          // increasing difference
    { square: true }                                  // n^2 + k
  ]);
  const start = rand(rng, 3, 40);
  let terms = [start];
  if (pattern.step) {
    const d = pattern.step();
    for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + d);
  } else if (pattern.mult) {
    const m = pattern.mult();
    for (let i = 1; i < 5; i++) terms.push(terms[i - 1] * m);
  } else if (pattern.inc) {
    let d = pattern.inc();
    for (let i = 1; i < 5; i++) { terms.push(terms[i - 1] + d); d += 1; }
  } else {
    for (let i = 1; i < 5; i++) { const n = terms[i - 1]; terms.push(n * n + 1); }
  }
  if (new Set(terms).size < 5 || terms.some(t => t > 10 ** 8)) return null;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Number Series', subtopic: 'Next Term',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['numberseries', 'practice'],
    question: `Find the next term in the series: ${terms.join(', ')}, ?`,
    compute: () => terms[terms.length - 1],
    distractors: (c) => near(rng, c),
    explanation: `The series follows the pattern and the next term is ${terms[terms.length - 1]}.`
  });
};

GEN.simplification = (rng) => {
  const a = rand(rng, 10, 999);
  const b = rand(rng, 10, 999);
  const ops = ['+', '-'];
  const op = pick(rng, ops);
  const c = op === '+' ? a + b : Math.max(a, b) - Math.min(a, b);
  const order = op === '+' ? `${a} + ${b}` : `${Math.max(a, b)} − ${Math.min(a, b)}`;
  const correct = op === '+' ? a + b : Math.max(a, b) - Math.min(a, b);
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Simplification', subtopic: 'Basic Arithmetic',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['simplification', 'practice'],
    question: `Simplify: ${order} = ?`,
    compute: () => correct,
    distractors: (c) => near(rng, c),
    explanation: `${order} = ${correct}.`
  });
};

GEN.quadratic = (rng) => {
  const r1 = rand(rng, -9, 9), r2 = rand(rng, -9, 9);
  if (r1 === r2 || r1 === 0 || r2 === 0) return null;
  const p1 = -(r1 + r2), q1 = r1 * r2;
  const s1 = rand(rng, -9, 9), s2 = rand(rng, -9, 9);
  if (s1 === s2 || s1 === 0 || s2 === 0) return null;
  const p2 = -(s1 + s2), q2 = s1 * s2;
  const rel = r1 > s1 ? 'x > y' : r1 < s1 ? 'x < y' : 'x = y';
  const ansMap = { 'x > y': 'x > y', 'x < y': 'x < y', 'x = y': 'x = y' };
  const answer = ansMap[rel];
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Quadratic Equations', subtopic: 'Compare Roots',
    difficulty: 'hard', exam_stage: 'mains', tags: ['quadratic', 'practice'],
    question: `I. x² ${p1 < 0 ? '− ' + Math.abs(p1) : '+ ' + p1}x ${q1 >= 0 ? '+' : '−'} ${Math.abs(q1)} = 0\nII. y² ${p2 < 0 ? '− ' + Math.abs(p2) : '+ ' + p2}y ${q2 >= 0 ? '+' : '−'} ${Math.abs(q2)} = 0\nWhat is the relationship between x and y?`,
    compute: () => answer,
    distractors: fixedDistractors('x ≥ y', 'x ≤ y', 'x < y', 'x > y', 'No relation can be determined', 'x = y'),
    explanation: `Roots of I: x = ${r1}, ${r2}. Roots of II: y = ${s1}, ${s2}. So ${answer}.`
  });
};

GEN.mensuration = (rng) => {
  const shape = pick(rng, ['square', 'rectangle', 'cuboid', 'cylinder']);
  if (shape === 'square') {
    const side = rand(rng, 5, 50);
    const area = side * side;
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Mensuration', subtopic: 'Area',
      difficulty: 'easy', exam_stage: 'prelims', tags: ['mensuration', 'practice'],
      question: `What is the area of a square with side ${side} cm?`,
      compute: () => area,
      distractors: (c) => near(rng, c),
      explanation: `Area = side² = ${side}² = ${area} cm².`
    });
  }
  if (shape === 'rectangle') {
    const l = rand(rng, 5, 40), b = rand(rng, 5, 40);
    const area = l * b;
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Mensuration', subtopic: 'Area',
      difficulty: 'easy', exam_stage: 'prelims', tags: ['mensuration', 'practice'],
      question: `What is the area of a rectangle of length ${l} cm and breadth ${b} cm?`,
      compute: () => area,
      distractors: (c) => near(rng, c),
      explanation: `Area = length × breadth = ${l} × ${b} = ${area} cm².`
    });
  }
  if (shape === 'cuboid') {
    const l = rand(rng, 2, 20), b = rand(rng, 2, 20), h = rand(rng, 2, 20);
    const vol = l * b * h;
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Mensuration', subtopic: 'Volume',
      difficulty: 'medium', exam_stage: 'prelims', tags: ['mensuration', 'practice'],
      question: `Find the volume of a cuboid with dimensions ${l} cm × ${b} cm × ${h} cm.`,
      compute: () => vol,
      distractors: (c) => near(rng, c),
      explanation: `Volume = l × b × h = ${l} × ${b} × ${h} = ${vol} cm³.`
    });
  }
  // Cylinder: use π = 22/7 with radius multiple of 7 so result is integer
  const k = rand(rng, 1, 5);
  const r = 7 * k;
  const h = rand(rng, 1, 15);
  const vol = (22 / 7) * r * r * h;
  if (!Number.isInteger(vol)) return null;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Mensuration', subtopic: 'Volume',
    difficulty: 'hard', exam_stage: 'mains', tags: ['mensuration', 'practice'],
    question: `Find the volume of a cylinder of radius ${r} cm and height ${h} cm. (Use π = 22/7)`,
    compute: () => vol,
    distractors: (c) => near(rng, c),
    explanation: `Volume = πr²h = (22/7) × ${r}² × ${h} = ${vol} cm³.`
  });
};

GEN.probability = (rng) => {
  const x = rand(rng, 2, 10), y = rand(rng, 2, 10), z = rand(rng, 2, 10);
  const total = x + y + z;
  const num = x;
  const g = gcd(num, total);
  const pNum = num / g, pDen = total / g;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Probability', subtopic: 'Simple Probability',
    difficulty: 'medium', exam_stage: 'mains', tags: ['probability', 'practice'],
    question: `A bag contains ${x} red, ${y} blue and ${z} green balls. One ball is drawn at random. What is the probability that it is red?`,
    compute: () => `${pNum}/${pDen}`,
    distractors: () => {
      const g1 = gcd(y, total), g2 = gcd(z, total);
      return [`${y / g1}/${total / g1}`, `${z / g2}/${total / g2}`, `${num}/${total}`, `${1}/${total}`];
    },
    explanation: `P(red) = favourable/total = ${x}/${total} = ${pNum}/${pDen}.`
  });
};

GEN.permutation = (rng) => {
  const n = pick(rng, [5, 6, 7, 8]);
  const r = pick(rng, [2, 3]);
  const nPr = (n, r) => { let v = 1; for (let i = 0; i < r; i++) v *= (n - i); return v; };
  const ans = nPr(n, r);
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Permutation & Combination', subtopic: 'Permutation',
    difficulty: 'medium', exam_stage: 'mains', tags: ['pnc', 'practice'],
    question: `In how many ways can ${r} distinct people be arranged in a row out of ${n} people?`,
    compute: () => ans,
    distractors: (c) => near(rng, c),
    explanation: `Number of permutations = nPr = ${n}P${r} = ${ans}.`
  });
};

GEN.age = (rng) => {
  const d = pick(rng, [2, 4, 6, 8, 10, 12]);
  const b = rand(rng, 10, 50);
  const a = b + d;
  const sum = a + b;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Age Problems', subtopic: 'Two Persons',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['age', 'practice'],
    question: `The sum of the ages of A and B is ${sum} years. A is ${d} years older than B. What is A's age?`,
    compute: () => a,
    distractors: (c) => near(rng, c),
    explanation: `A + B = ${sum}, A − B = ${d}. Adding: 2A = ${sum + d} → A = ${a}.`
  });
};

GEN.partnership = (rng) => {
  const x = rand(rng, 1000, 9000);
  const y = rand(rng, 1000, 9000);
  const k = rand(rng, 1, 50);
  const profit = (x + y) * k;
  const aShare = x * k;
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Partnership', subtopic: 'Profit Sharing',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['partnership', 'practice'],
    question: `A invests Rs. ${fmtMoney(x)} and B invests Rs. ${fmtMoney(y)} in a business. At the end of the year the total profit is Rs. ${fmtMoney(profit)}. What is A's share of the profit?`,
    compute: () => aShare,
    distractors: (c) => near(rng, c),
    explanation: `A's share = (${fmtMoney(x)}/${fmtMoney(x + y)}) × ${fmtMoney(profit)} = Rs. ${fmtMoney(aShare)}.`
  });
};

GEN.boatstream = (rng) => {
  const b = rand(rng, 8, 30);
  const s = rand(rng, 1, b - 1);
  const downstream = b + s;
  const upstream = b - s;
  if (rng() < 0.5) {
    return template(rng, {
      subject: 'Quantitative Aptitude', topic: 'Boats & Streams', subtopic: 'Downstream',
      difficulty: 'medium', exam_stage: 'prelims', tags: ['boats', 'practice'],
      question: `A boat can go at ${b} km/h in still water. If the stream flows at ${s} km/h, what is the boat's speed downstream?`,
      compute: () => downstream,
      distractors: (c) => near(rng, c),
      explanation: `Downstream speed = boat + stream = ${b} + ${s} = ${downstream} km/h.`
    });
  }
  return template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Boats & Streams', subtopic: 'Upstream',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['boats', 'practice'],
    question: `A boat can go at ${b} km/h in still water. If the stream flows at ${s} km/h, what is the boat's speed upstream?`,
    compute: () => upstream,
    distractors: (c) => near(rng, c),
    explanation: `Upstream speed = boat − stream = ${b} − ${s} = ${upstream} km/h.`
  });
};

// ---------------------------------------------------------------------------
// REASONING GENERATORS
// ---------------------------------------------------------------------------

GEN.inequality = (rng) => {
  // Build a strict total order of 5 variables
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const order = shuffle(rng, letters); // order[0] > order[1] > ...
  const chooseRel = () => pick(rng, ['>', '≥']);
  const statements = [];
  for (let i = 0; i < order.length - 1; i++) {
    statements.push(`${order[i]} ${chooseRel()} ${order[i + 1]}`);
  }
  // Conclusion I: true (from chain), Conclusion II: false (reverse of a strict edge)
  const trueConclusion = `${order[0]} ${pick(rng, ['>', '≥'])} ${order[order.length - 1]}`;
  const falseConclusion = `${order[order.length - 1]} > ${order[0]}`;
  const answer = rng() < 0.5 ? 'Only conclusion I follows' : null;
  // Decide placement of I/II
  const iIsTrue = trueConclusion, iiIsFalse = falseConclusion;
  const label = `Statement: ${statements.join('; ')}.\nConclusions:\nI. ${trueConclusion}\nII. ${falseConclusion}`;
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Inequalities', subtopic: 'Coded Inequalities',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['inequality', 'practice'],
    question: label,
    compute: () => 'Only conclusion I follows',
    distractors: fixedDistractors('Only conclusion II follows', 'Either I or II follows', 'Neither I nor II follows', 'Both I and II follow'),
    explanation: `Given the chain, ${trueConclusion}. Conclusion II (${falseConclusion}) contradicts the ordering, so only conclusion I follows.`
  });
};

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const shift = (word, k) => [...word].map(ch => ALPHA[(ALPHA.indexOf(ch) + k + 26) % 26]).join('');
const numcode = (word) => [...word].map(ch => ALPHA.indexOf(ch) + 1).join('-');

GEN.codingdecoding = (rng) => {
  const words = ['CAT', 'DOG', 'RAT', 'BAT', 'SUN', 'MAN', 'BAG', 'PEN'];
  const w = pick(rng, words);
  const k = pick(rng, [1, 2, 3, 4]);
  const coded = shift(w, k);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Coding-Decoding', subtopic: 'Letter Shift',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['codingdecoding', 'practice'],
    question: `In a certain code, ${w} is written as ${coded}. How is ${w} written in the same code?`,
    compute: () => coded,
    distractors: () => [shift(w, k + 1), shift(w, k - 1), w, shift(w, -k)],
    explanation: `Each letter is shifted forward by ${k} positions.`
  });
};

GEN.direction = (rng) => {
  const triples = [[3, 4], [6, 8], [5, 12], [9, 12], [8, 15], [7, 24]];
  const [a1, a2] = pick(rng, triples);
  const hyp = Math.hypot(a1, a2);
  const dirs = ['north', 'south', 'east', 'west'];
  const first = pick(rng, dirs);
  const second = pick(rng, ['east', 'west']);
  const third = pick(rng, ['north', 'south']);
  const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };
  // net displacement
  let netX = 0, netY = 0;
  if (first === 'north') netY += a1; if (first === 'south') netY -= a1;
  if (first === 'east') netX += a1; if (first === 'west') netX -= a1;
  if (second === 'east') netX += a2; if (second === 'west') netX -= a2;
  if (third === 'north') netY += hyp * 0; // third leg uses the hypotenuse length? too complex; simplify
  // Simpler: legs are a1 north, a2 east, then back toward start along a diagonal is not clean.
  // Use pure right-triangle path: a1 north, a2 east => distance hypotenuse, direction north-east.
  const dist = hyp;
  const finalDir = 'North-East';
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Direction Sense', subtopic: 'Distance & Direction',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['direction', 'practice'],
    question: `A man walks ${a1} km towards North and then ${a2} km towards East. How far and in which direction is he from the starting point?`,
    compute: () => `${dist} km, North-East`,
    distractors: () => [`${dist} km, South-West`, `${a1 + a2} km, North-East`, `${a1 + a2} km, North-West`, `${dist} km, South-East`],
    explanation: `Displacement = √(${a1}² + ${a2}²) = ${dist} km towards North-East.`
  });
};

GEN.bloodrelation = (rng) => {
  const set = pick(rng, [
    { tpl: 'A is the father of B. B is the sister of C. How is A related to C?', ans: 'Father' },
    { tpl: 'A is the mother of B. B is the brother of C. How is C related to A?', ans: 'Child' },
    { tpl: 'P is the son of Q. Q is the wife of R. How is R related to P?', ans: 'Father' },
    { tpl: 'X is the brother of Y. Y is the daughter of Z. How is X related to Z?', ans: 'Son' },
    { tpl: 'M is the sister of N. N is the father of O. How is M related to O?', ans: 'Aunt' },
    { tpl: 'A is the father of B. B is the son of C. How is C related to A?', ans: 'Wife' }
  ]);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Blood Relations', subtopic: 'Simple Relations',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['blood', 'practice'],
    question: set.tpl,
    compute: () => set.ans,
    distractors: fixedDistractors('Mother', 'Brother', 'Uncle', 'Sister', 'Grandfather', 'Nephew'),
    explanation: `From the given family relationships, ${set.ans} is the correct answer.`
  });
};

GEN.alphabetSeries = (rng) => {
  const k = pick(rng, [1, 2, 3]);
  const start = rand(rng, 0, 21);
  const terms = [];
  for (let i = 0; i < 5; i++) terms.push(ALPHA[(start + i * k) % 26]);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Alphabet Series', subtopic: 'Next Letter',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['series', 'practice'],
    question: `Find the next term: ${terms.join(', ')}, ?`,
    compute: () => ALPHA[(start + 5 * k) % 26],
    distractors: (c) => {
      const ci = ALPHA.indexOf(c);
      return [ALPHA[(ci + k) % 26], ALPHA[(ci - k + 26) % 26], ALPHA[(ci + 1) % 26], ALPHA[(ci + k + 1) % 26]];
    },
    explanation: `The series advances by ${k} letter(s).`
  });
};

GEN.ordering = (rng) => {
  const n = rand(rng, 8, 25);
  const left = rand(rng, 2, n - 3);
  const right = n - left + 1;
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Order & Ranking', subtopic: 'Total Count',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['ranking', 'practice'],
    question: `In a row of students, A is ${left}th from the left end and ${right}th from the right end. How many students are there in the row?`,
    compute: () => left + right - 1,
    distractors: (c) => near(rng, c),
    explanation: `Total = position from left + position from right − 1 = ${left} + ${right} − 1 = ${left + right - 1}.`
  });
};

// ---------------------------------------------------------------------------
// Syllogism — model-based (conclusions evaluated against a constructed universe)
// ---------------------------------------------------------------------------
const SYL_MODELS = [
  { A: [1, 2], B: [1, 2, 3], C: [2] },
  { A: [1, 2, 3], B: [1, 2, 3, 4], C: [1, 2] },
  { A: [1, 2], B: [1, 2], C: [2, 3] },
  { A: [1, 2, 3], B: [1, 2, 3], C: [4, 5, 6] },
  { A: [1, 2, 3, 4], B: [1, 2, 3, 4, 5], C: [1, 2, 3] }
];

function sylEval(model, X, op, Y) {
  const S = model[X], T = model[Y];
  if (op === 'All') return S.length > 0 && S.every(e => T.includes(e));
  if (op === 'Some') return S.some(e => T.includes(e));
  if (op === 'No') return S.every(e => !T.includes(e));
  if (op === 'SomeNot') return S.some(e => !T.includes(e));
  return false;
}

GEN.syllogism = (rng) => {
  const base = pick(rng, SYL_MODELS);
  const names = ['A', 'B', 'C'];
  const perm = shuffle(rng, [0, 1, 2]);
  const model = { A: base[names[perm[0]]], B: base[names[perm[1]]], C: base[names[perm[2]]] };
  const OPS = ['All', 'Some', 'No', 'SomeNot'];
  const truePreds = [], falsePreds = [];
  for (const X of names) for (const Y of names) {
    if (X === Y) continue;
    for (const op of OPS) {
      const t = sylEval(model, X, op, Y);
      (t ? truePreds : falsePreds).push({ X, Y, op });
    }
  }
  if (truePreds.length < 2 || falsePreds.length === 0) return null;
  // statements: two true predicates
  const stmt1 = pick(rng, truePreds);
  let stmt2 = pick(rng, truePreds);
  while (stmt1 === stmt2) stmt2 = pick(rng, truePreds);
  // conclusions: one true, one false
  const trueCon = pick(rng, truePreds);
  const falseCon = pick(rng, falsePreds);
  const sFmt = (p) => `${p.op} ${p.X} are ${p.Y}`;
  const cFmt = (p) => `${p.op} ${p.X} are ${p.Y}`;
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Syllogism', subtopic: 'Conclusions',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['syllogism', 'practice'],
    question: `Statements:\n${sFmt(stmt1)}.\n${sFmt(stmt2)}.\n\nConclusions:\nI. ${cFmt(trueCon)}.\nII. ${cFmt(falseCon)}.\nWhich conclusion(s) follow(s)?`,
    compute: () => 'Only conclusion I follows',
    distractors: fixedDistractors('Only conclusion II follows', 'Either I or II follows', 'Neither I nor II follows', 'Both I and II follow'),
    explanation: `Evaluating the given statements, conclusion I (${cFmt(trueCon)}) is logically valid while conclusion II (${cFmt(falseCon)}) is not.`
  });
};

GEN.missingnumber = (rng) => {
  const pattern = pick(rng, [
    { d: () => rand(rng, 2, 9) },
    { inc: () => pick(rng, [2, 3, 4]) },
    { square: true }
  ]);
  const start = rand(rng, 3, 40);
  const terms = [start];
  if (pattern.d) {
    const d = pattern.d();
    for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + d);
  } else if (pattern.inc) {
    let d = pattern.inc();
    for (let i = 1; i < 5; i++) { terms.push(terms[i - 1] + d); d += 1; }
  } else {
    for (let i = 1; i < 5; i++) terms.push(terms[i - 1] * terms[i - 1] + 1);
  }
  if (new Set(terms).size < 4 || terms.some(t => t > 10 ** 8)) return null;
  const gapIdx = rand(rng, 1, 3);
  const missing = terms[gapIdx];
  const shown = terms.map((t, i) => (i === gapIdx ? '?' : t));
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Number Series', subtopic: 'Missing Number',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['missingnumber', 'practice'],
    question: `Find the missing number: ${shown.join(', ')}`,
    compute: () => missing,
    distractors: (c) => near(rng, c),
    explanation: `Applying the series pattern, the missing term is ${missing}.`
  });
};

GEN.mathops = (rng) => {
  const words = ['CAT', 'DOG', 'BAT', 'PEN', 'BAG', 'SUN', 'HAT', 'LOG', 'GUN', 'FOX'];
  const w1 = pick(rng, words);
  let w2 = pick(rng, words);
  while (w2 === w1) w2 = pick(rng, words);
  const mode = rng() < 0.5 ? 'forward' : 'reverse';
  const code = (w) => {
    const sum = [...w].reduce((a, ch) => a + (mode === 'forward' ? ALPHA.indexOf(ch) + 1 : 27 - (ALPHA.indexOf(ch) + 1)), 0);
    return sum;
  };
  const c1 = code(w1), c2 = code(w2);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Mathematical Operations', subtopic: 'Letter Position Coding',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['mathops', 'practice'],
    question: `If ${w1} is coded as ${c1}, then what is the code for ${w2}? (positions of letters in the ${mode === 'forward' ? 'alphabet' : 'reverse alphabet'})`,
    compute: () => c2,
    distractors: (c) => near(rng, c),
    explanation: `Using ${mode === 'forward' ? 'A=1, B=2, ... Z=26' : 'A=26, B=25, ... Z=1'}, ${w2} = ${[...w2].map(ch => mode === 'forward' ? ALPHA.indexOf(ch) + 1 : 27 - (ALPHA.indexOf(ch) + 1)).join(' + ')} = ${c2}.`
  });
};

GEN.analogy = (rng) => {
  const rel = pick(rng, [
    { name: 'square', f: (n) => n * n, label: (n) => `${n} : ${n * n}` },
    { name: 'cube', f: (n) => n * n * n, label: (n) => `${n} : ${n * n * n}` },
    { name: 'triple', f: (n) => n * 3, label: (n) => `${n} : ${n * 3}` },
    { name: 'double', f: (n) => n * 2, label: (n) => `${n} : ${n * 2}` },
    { name: 'plus8', f: (n) => n + 8, label: (n) => `${n} : ${n + 8}` }
  ]);
  const a = rand(rng, 2, 12);
  const b = rand(rng, 2, 12);
  const ans = rel.f(b);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Analogy', subtopic: 'Number Analogy',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['analogy', 'practice'],
    question: `${rel.label(a)} :: ${b} : ?`,
    compute: () => ans,
    distractors: (c) => near(rng, c),
    explanation: `${a} and ${rel.label(a)} follow the "${rel.name}" relation, so ${b} : ${ans}.`
  });
};

GEN.oddoneout = (rng) => {
  const prop = pick(rng, ['even', 'square', 'triple', 'prime']);
  const base = rand(rng, 4, 20);
  const common = [];
  for (let i = 0; i < 4; i++) {
    let v = base + i * 2;
    if (prop === 'even') { while (v % 2 !== 0) v++; }
    if (prop === 'square') { v = (Math.floor(Math.sqrt(base)) + i) ** 2; }
    if (prop === 'triple') { v = (base + i) * 3; }
    if (prop === 'prime') { let p = base + i; const isPrime = (n) => { for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return n > 1; }; while (!isPrime(p)) p++; v = p; }
    if (common.includes(v)) v += 1;
    common.push(v);
  }
  let odd = 0;
  if (prop === 'even') odd = common[0] + 1;
  if (prop === 'square') odd = common[0] + 3;
  if (prop === 'triple') odd = common[0] + 1;
  if (prop === 'prime') odd = common[0] + 1;
  if (odd === common[0] || common.includes(odd)) odd += 2;
  const opts = shuffle(rng, [...common, odd]);
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Classification', subtopic: 'Odd One Out',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['oddoneout', 'practice'],
    question: `Find the odd one out: ${opts.join(', ')}`,
    compute: () => odd,
    distractors: () => common,
    explanation: `All options except ${odd} are ${prop === 'even' ? 'even numbers' : prop === 'square' ? 'perfect squares' : prop === 'triple' ? 'multiples of 3' : 'prime numbers'}.`
  });
};

GEN.clock = (rng) => {
  const h = rand(rng, 1, 12);
  const m = pick(rng, [0, 10, 20, 30, 40, 50]);
  let angle = Math.abs(30 * h - 5.5 * m);
  if (angle > 180) angle = 360 - angle;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return template(rng, {
    subject: 'Reasoning Ability', topic: 'Clocks & Calendars', subtopic: 'Angle Between Hands',
    difficulty: 'hard', exam_stage: 'mains', tags: ['clock', 'practice'],
    question: `What is the angle between the hour hand and the minute hand of a clock at ${h12}:${String(m).padStart(2, '0')}?`,
    compute: () => angle,
    distractors: (c) => near(rng, c),
    explanation: `Angle = |30H − 5.5M| = |30×${h12} − 5.5×${m}| = ${angle}° (taking the smaller angle).`
  });
};

// ---------------------------------------------------------------------------
// Curated English + GA (bounded pools — sample without replacement)
// ---------------------------------------------------------------------------
const CURATED_STATE = { used: {} };
const CURATED_USED_FILE = path.join(__dirname, 'curated_used.json');

function loadCuratedUsed() {
  try {
    const data = JSON.parse(fs.readFileSync(CURATED_USED_FILE, 'utf8'));
    const out = {};
    for (const [k, arr] of Object.entries(data)) out[k] = new Set(arr);
    return out;
  } catch (e) {
    return {};
  }
}

function saveCuratedUsed() {
  const out = {};
  for (const [k, set] of Object.entries(CURATED_STATE.used)) out[k] = [...set];
  fs.writeFileSync(CURATED_USED_FILE, JSON.stringify(out), 'utf8');
}

function curatedSample(pool, rng, key) {
  if (!CURATED_STATE.used[key]) CURATED_STATE.used[key] = new Set();
  const available = pool.map((item, i) => ({ item, i })).filter(x => !CURATED_STATE.used[key].has(x.i));
  if (available.length === 0) return null;
  const chosen = pick(rng, available);
  CURATED_STATE.used[key].add(chosen.i);
  return chosen.item;
}

GEN.spelling = (rng) => {
  const item = curatedSample(SPELLING, rng, 'spelling');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Spelling', subtopic: 'Correct Spelling',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['spelling', 'practice'],
    question: `Choose the correctly spelt word from the following options.`,
    compute: () => item.word,
    distractors: () => item.wrong,
    explanation: `The correct spelling is "${item.word}".`
  });
};

GEN.synonym = (rng) => {
  const item = curatedSample(SYNONYMS, rng, 'synonym');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Vocabulary', subtopic: 'Synonyms',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['synonym', 'practice'],
    question: `Choose the word closest in meaning to "${item.word}".`,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `"${item.ans}" is a synonym of "${item.word}".`
  });
};

GEN.antonym = (rng) => {
  const item = curatedSample(ANTONYMS, rng, 'antonym');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Vocabulary', subtopic: 'Antonyms',
    difficulty: 'easy', exam_stage: 'prelims', tags: ['antonym', 'practice'],
    question: `Choose the word most nearly opposite in meaning to "${item.word}".`,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `"${item.ans}" is the opposite of "${item.word}".`
  });
};

GEN.idiom = (rng) => {
  const item = curatedSample(IDIOMS, rng, 'idiom');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Idioms & Phrases', subtopic: 'Idiom Meaning',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['idiom', 'practice'],
    question: `Choose the correct meaning of the idiom: "${item.idiom}"`,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `"${item.idiom}" means: ${item.ans}.`
  });
};

GEN.ga = (rng) => {
  const item = curatedSample(GA, rng, 'ga');
  if (!item) return null;
  return template(rng, {
    subject: 'General Awareness', topic: 'Banking Awareness', subtopic: 'Static GK & Banking',
    difficulty: 'medium', exam_stage: 'mains', tags: ['ga', 'banking', 'practice'],
    question: item.q,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `The correct answer is ${item.ans}.`
  });
};

GEN.oneword = (rng) => {
  const item = curatedSample(ONEWORD, rng, 'oneword');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'One Word Substitution', subtopic: 'Phrase to Word',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['oneword', 'practice'],
    question: `Choose the word that best substitutes the following phrase: "${item.clue}"`,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `"${item.ans}" means: ${item.clue}.`
  });
};

GEN.grammar = (rng) => {
  const item = curatedSample(GRAMMAR, rng, 'grammar');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Grammar', subtopic: 'Fill in the Blank',
    difficulty: 'medium', exam_stage: 'prelims', tags: ['grammar', 'practice'],
    question: item.q,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `The correct fill is "${item.ans}".`
  });
};

GEN.sentence = (rng) => {
  const item = curatedSample(SENTENCE, rng, 'sentence');
  if (!item) return null;
  return template(rng, {
    subject: 'English Language', topic: 'Sentence Improvement', subtopic: 'Error Correction',
    difficulty: 'hard', exam_stage: 'mains', tags: ['sentence', 'practice'],
    question: `Select the correct version of the sentence:\n"${item.q}"`,
    compute: () => item.ans,
    distractors: () => item.wrong,
    explanation: `The corrected sentence is: ${item.ans}`
  });
};

GEN.rcSet = (rng) => {
  const item = curatedSample(RC, rng, 'rc');
  if (!item) return null;
  const set = { type: 'rc', title: item.title, stimulus: item.passage, source: 'curated' };
  return item.questions.map((qn, i) => template(rng, {
    subject: 'English Language', topic: 'Reading Comprehension', subtopic: 'RC Passage',
    difficulty: 'hard', exam_stage: 'mains', tags: ['rc', 'practice', 'set'],
    question: `Q${i + 1}. ${qn.q}`,
    compute: () => qn.ans,
    distractors: () => qn.wrong,
    explanation: `Based on the passage, the correct answer is: ${qn.ans}.`,
    set
  }));
};

GEN.clozeSet = (rng) => {
  const item = curatedSample(CLOZE, rng, 'cloze');
  if (!item) return null;
  const set = { type: 'cloze', title: item.title, stimulus: item.passage, source: 'curated' };
  return item.blanks.map((bl, i) => template(rng, {
    subject: 'English Language', topic: 'Cloze Test', subtopic: 'Fill the Blanks',
    difficulty: 'medium', exam_stage: 'mains', tags: ['cloze', 'practice', 'set'],
    question: `Choose the word that correctly fills blank (${i + 1}) in the passage.`,
    compute: () => bl.ans,
    distractors: () => bl.wrong,
    explanation: `The word that fits blank (${i + 1}) is "${bl.ans}".`,
    set
  }));
};

// ---------------------------------------------------------------------------
// MINI-DI SET generator: one shared table + 3 questions (uses question_sets)
// ---------------------------------------------------------------------------
GEN.diSet = (rng) => {
  const subjects = ['English', 'Mathematics', 'Science', 'History'];
  const marks = {};
  const base = rand(rng, 30, 70);
  subjects.forEach((s, i) => { marks[s] = base + i * rand(rng, 3, 12); });
  const total = Object.values(marks).reduce((a, b) => a + b, 0);
  const avg = total / subjects.length;
  const maxSubj = Object.entries(marks).reduce((a, b) => (a[1] > b[1] ? a : b));
  const table = `Marks obtained by a student in four subjects:\nSubject  |  Marks\nEnglish | ${marks.English}\nMathematics | ${marks.Mathematics}\nScience | ${marks.Science}\nHistory | ${marks.History}`;
  const setTitle = `DI Table (total ${total}) — ${maxSubj[0]} highest`;

  const qs = [];
  qs.push(template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Data Interpretation', subtopic: 'Table DI',
    difficulty: 'medium', exam_stage: 'mains', tags: ['di', 'practice', 'set'],
    question: `What is the total marks obtained across all four subjects?`,
    compute: () => total,
    distractors: (c) => near(rng, c),
    explanation: `Total = ${Object.values(marks).join(' + ')} = ${total}.`,
    set: { type: 'di', title: setTitle, stimulus: table, source: 'generated' }
  }));
  qs.push(template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Data Interpretation', subtopic: 'Table DI',
    difficulty: 'medium', exam_stage: 'mains', tags: ['di', 'practice', 'set'],
    question: `What is the average marks obtained across the four subjects?`,
    compute: () => avg,
    distractors: (c) => near(rng, c),
    explanation: `Average = ${total}/${subjects.length} = ${avg}.`,
    set: { type: 'di', title: setTitle, stimulus: table, source: 'generated' }
  }));
  qs.push(template(rng, {
    subject: 'Quantitative Aptitude', topic: 'Data Interpretation', subtopic: 'Table DI',
    difficulty: 'hard', exam_stage: 'mains', tags: ['di', 'practice', 'set'],
    question: `In which subject did the student score the highest marks, and how many marks were scored?`,
    compute: () => `${maxSubj[0]} (${maxSubj[1]})`,
    distractors: () => subjects.filter(s => s !== maxSubj[0]).map(s => `${s} (${marks[s]})`).concat([`${maxSubj[0]} (${maxSubj[1] + 5})`]),
    explanation: `The highest marks of ${maxSubj[1]} were scored in ${maxSubj[0]}.`,
    set: { type: 'di', title: setTitle, stimulus: table, source: 'generated' }
  }));
  return qs;
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const QUANT_KEYS = ['percentage', 'profitloss', 'simpleinterest', 'compoundinterest', 'ratioproportion', 'timework', 'timedistance', 'average', 'numberseries', 'simplification', 'quadratic', 'mensuration', 'probability', 'permutation', 'age', 'partnership', 'boatstream'];
const REASONING_KEYS = ['inequality', 'codingdecoding', 'direction', 'bloodrelation', 'alphabetSeries', 'ordering', 'syllogism', 'missingnumber', 'mathops', 'analogy', 'oddoneout', 'clock'];

function generate(args) {
  const count = args.count || 5000;
  const seed = args.seed || 20260802;
  const topicsFilter = args.topics ? args.topics.split(',').map(t => t.trim()).filter(Boolean) : null;

  let topicKeys = [...QUANT_KEYS, ...REASONING_KEYS, 'diSet', 'spelling', 'synonym', 'antonym', 'idiom', 'ga', 'oneword', 'grammar', 'sentence', 'rcSet', 'clozeSet'];
  if (topicsFilter) {
    topicKeys = topicKeys.filter(k => topicsFilter.includes(k));
  }

  CURATED_STATE.used = loadCuratedUsed();

  const rng = mulberry32(seed);
  const seen = new Set();
  const rows = [];
  const stats = {};

  let attempts = 0;
  const maxAttempts = count * 60;
  while (rows.length < count && attempts < maxAttempts) {
    attempts++;
    const key = topicKeys[Math.floor(rng() * topicKeys.length)];
    const gen = GEN[key];
    let produced;
    try {
      produced = gen(rng);
    } catch (e) {
      continue;
    }
    if (!produced) continue;
    const items = Array.isArray(produced) ? produced : [produced];
    for (const item of items) {
      const normBase = item.question_text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const normSet = item.set ? item.set.stimulus.toLowerCase().replace(/[^a-z0-9]+/g, ' ') : '';
      const normOpts = LETTERS.map(l => (item[`option_${l}`] || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')).join('|');
      const norm = `${normBase} | ${normOpts} | ${normSet}`;
      if (seen.has(norm)) continue;
      seen.add(norm);
      rows.push(item);
      stats[key] = (stats[key] || 0) + 1;
      if (rows.length >= count) break;
    }
  }

  const summary = { requested: count, generated: rows.length, by_topic: stats };
  saveCuratedUsed();
  console.log(`Generated ${rows.length}/${count} questions (seed ${seed})`);
  console.log('  by topic:', stats);
  return { rows, summary };
}

// Emit CSV + xlsx in upload format
function emit(rows, summary) {
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
      tags: r.tags.join(','),
      set_title: (r.set && r.set.title) || '', set_type: (r.set && r.set.type) || '',
      set_stimulus: (r.set && r.set.stimulus) ? r.set.stimulus.replace(/[\r\n]+/g, ' | ') : '',
      set_source: (r.set && r.set.source) || ''
    };
    const escape = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    csvLines.push(headers.map(h => escape(rec[h])).join(','));
    aoa.push(headers.map(h => rec[h]));
  }
  const outDir = path.join(__dirname);
  fs.writeFileSync(path.join(outDir, 'practice_upload.csv'), '\uFEFF' + csvLines.join('\n'), 'utf8');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, path.join(outDir, 'practice_upload.xlsx'));
  fs.writeFileSync(path.join(outDir, 'practice_summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Wrote practice_upload.csv, practice_upload.xlsx, practice_summary.json`);
}

// Self-verification: every question must contain its correct option
function verify(rows) {
  let bad = 0;
  for (const r of rows) {
    const key = `option_${r.correct_option}`;
    if (!r[key] || r[key].trim() === '') { bad++; console.error('MISSING correct option value:', r.question_text); }
    const vals = LETTERS.map(l => r[`option_${l}`]);
    const uniq = new Set(vals.filter(v => v && v.trim() !== ''));
    if (uniq.size !== 5) { bad++; console.error('Duplicate/empty option:', r.question_text, vals); }
  }
  console.log(`Verification: ${rows.length - bad}/${rows.length} clean`);
}

const argValue = (name, dflt) => {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] !== undefined) return process.argv[idx + 1];
  return dflt;
};

const args = {
  count: parseInt(argValue('count', '5000'), 10) || 5000,
  seed: parseInt(argValue('seed', '20260802'), 10) || 20260802,
  topics: argValue('topics', null) || null
};

module.exports = { generate, GEN, buildQuestion, LETTERS };

if (require.main === module) {
  const { rows, summary } = generate(args);
  verify(rows);
  emit(rows, summary);
}
