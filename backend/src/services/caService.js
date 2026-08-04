const pool = require('../database/db');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS current_affairs (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    category TEXT,
    source TEXT,
    source_url TEXT,
    link TEXT,
    image_url TEXT,
    pub_date TEXT,
    fetched_at TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
    UNIQUE(link)
  )`,
  `CREATE TABLE IF NOT EXISTS ca_quiz_questions (
    id BIGSERIAL PRIMARY KEY,
    ca_item_id INTEGER REFERENCES current_affairs(id),
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    option_e TEXT,
    correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd', 'e')),
    explanation TEXT,
    category TEXT,
    created_at TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_current_affairs_pub_date ON current_affairs(pub_date)',
  'CREATE INDEX IF NOT EXISTS idx_current_affairs_category ON current_affairs(category)',
  'CREATE INDEX IF NOT EXISTS idx_ca_quiz_category ON ca_quiz_questions(category)',
  `CREATE TABLE IF NOT EXISTS ca_fetch_log (
     id BIGSERIAL PRIMARY KEY,
     day TEXT NOT NULL,
     total_inserted INTEGER NOT NULL DEFAULT 0,
     reclassified INTEGER NOT NULL DEFAULT 0,
     status TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'error')),
     per_cat TEXT,
     failed_categories TEXT,
     created_at TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
   )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_fetch_log_day ON ca_fetch_log(day)'
];

const API_KEY = process.env.NEWSDATA_API_KEY || 'pub_1dbb22f6d99a41cd92ba9d0ab542031c';
const API_URL = 'https://newsdata.io/api/1/news';

const CATEGORIES = ['business', 'politics', 'technology', 'science', 'education', 'world', 'health'];

function truncate(text, max) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trim() + '\u2026';
}

async function ensureSchema() {
  const client = await pool.connect();
  try {
    for (const s of SCHEMA) await client.query(s);
  } finally {
    client.release();
  }
}

async function fetchCategory(category) {
  const url = `${API_URL}?apikey=${encodeURIComponent(API_KEY)}&country=in&language=en&category=${category}&size=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`NewsData ${category} HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'success') throw new Error(`NewsData ${category}: ${data.message || 'unknown error'}`);
  return data.results || [];
}

async function insertItems(client, items, requestedCategory) {
  let inserted = 0;
  for (const it of items) {
    if (!it.title || !it.link) continue;
    const cats = Array.isArray(it.category) ? it.category : (it.category ? [it.category] : []);
    const normalized = (c) => (c === 'top' ? null : c);
    const preferred = cats.map(normalized).filter(Boolean);
    const category = preferred.includes(requestedCategory)
      ? requestedCategory
      : (preferred[0] || normalized(requestedCategory) || 'general');
    const result = await client.query(
      `INSERT INTO current_affairs (title, description, content, category, source, source_url, link, image_url, pub_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (link) DO NOTHING
       RETURNING id`,
      [
        truncate(it.title, 300),
        truncate(it.description, 500),
        truncate(it.content || it.ai_summary, 1500),
        category,
        it.source_name || it.source_id || '',
        it.source_url || '',
        it.link,
        it.image_url || '',
        it.pubDate ? it.pubDate.slice(0, 10) : null
      ]
    );
    if (result.rows.length > 0) {
      await makeQuizQuestion(client, result.rows[0].id, it, category);
      inserted++;
    }
  }
  return inserted;
}

function distractor(category, index) {
  const pools = {
    business: ['Relates to a government budget announcement', 'Concerns a foreign stock exchange', 'Is about a sports sponsorship deal'],
    politics: ['Announces a new defence procurement', 'Is a state election campaign update', 'Concerns an international summit invitation'],
    technology: ['Launches a new smartphone by a foreign brand', 'Is about a cricket team\u2019s tech sponsor', 'Updates a food delivery app feature'],
    science: ['Reports a weather forecast for next month', 'Is about a new Hindi film release', 'Concerns a new rail route in Europe'],
    education: ['Is about a university ranking in the UK', 'Announces a new tourism policy', 'Concerns a change in office timings'],
    world: ['Reports a domestic state-level election', 'Is about an Indian film award', 'Concerns a local street festival'],
    health: ['Is about a new fitness club opening', 'Concerns a cricket match result', 'Announces a new airline route'],
    general: ['Refers to an event from the previous decade', 'Is an opinion piece on cricket', 'Concerns a fictional announcement']
  };
  const list = pools[category] || pools.general;
  return list[index % list.length];
}

async function makeQuizQuestion(client, caItemId, item, category) {
  const q = truncate(item.title, 220);
  const correct = truncate(item.description || item.ai_summary || item.title, 220) || 'The headline above reports a recent development.';
  const wrong = [0, 1, 2].map((i) => distractor(category, i));
  await client.query(
    `INSERT INTO ca_quiz_questions (ca_item_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      caItemId,
      `Based on the latest news, which of the following is the correct description of the headline: "${q}"?`,
      correct,
      wrong[0],
      wrong[1],
      wrong[2],
      'a',
      truncate(item.description || item.ai_summary, 800),
      category
    ]
  );
}

const KEYWORD_CATEGORIES = [
  { cat: 'business', words: ['market', 'economy', 'bank', 'rbi', 'gst', 'stock', 'share', 'tax', 'trade', 'budget', 'rupee', 'inflation', 'profit', 'loan', 'investment', 'industry', 'manufacturing', 'finance', 'sebi', 'npci', 'upi'] },
  { cat: 'politics', words: ['parliament', 'election', 'minister', 'government', 'legislation', 'bill', 'policy', 'cabinet', 'pm modi', 'president', 'union', 'state', 'political', 'modi', 'lok sabha', 'rajya sabha'] },
  { cat: 'science', words: ['isro', 'nasa', 'space', 'scientist', 'research', 'physics', 'mission', 'satellite', 'disease', 'vaccine', 'study', 'climate', 'genome', 'ai model'] },
  { cat: 'technology', words: ['technology', 'digital', 'software', 'internet', 'app', 'chip', 'startup', 'data', 'cyber', 'platform', 'tech'] },
  { cat: 'education', words: ['education', 'school', 'college', 'university', 'students', 'exam', 'nep', 'curriculum', 'scholarship', 'iit', 'board'] },
  { cat: 'world', words: ['g20', 'un', 'nato', 'summit', 'treaty', 'ambassador', 'diplomatic', 'foreign', 'international', 'conflict', 'war', 'china', 'russia', 'us president'] },
  { cat: 'health', words: ['health', 'hospital', 'ayush', 'doctor', 'medical', 'disease', 'patients', 'immunisation', 'maternal', 'healthcare'] }
];

function classifyCategory(text) {
  const t = (text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const { cat, words } of KEYWORD_CATEGORIES) {
    let score = 0;
    for (const w of words) if (t.includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return bestScore > 0 ? best : null;
}

async function reclassifyUncategorized() {
  const result = await pool.query("SELECT id, title, description, category FROM current_affairs WHERE category IN ('top', 'general')");
  let updated = 0;
  for (const row of result.rows) {
    const cat = classifyCategory(`${row.title} ${row.description}`);
    if (cat && cat !== row.category) {
      await pool.query('UPDATE current_affairs SET category = $1 WHERE id = $2', [cat, row.id]);
      updated++;
    }
  }
  return updated;
}

async function logFetchRun({ totalInserted, reclassified, perCat, failedCategories, fatalError }) {
  await ensureSchema();
  const day = new Date().toISOString().slice(0, 10);
  let status = 'ok';
  if (fatalError || (failedCategories && failedCategories.length > 0)) {
    status = totalInserted === 0 ? 'error' : 'partial';
  }
  await pool.query(
    `INSERT INTO ca_fetch_log (day, total_inserted, reclassified, status, per_cat, failed_categories)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (day) DO UPDATE SET
       total_inserted = EXCLUDED.total_inserted,
       reclassified = EXCLUDED.reclassified,
       status = EXCLUDED.status,
       per_cat = EXCLUDED.per_cat,
       failed_categories = EXCLUDED.failed_categories`,
    [day, totalInserted, reclassified, status, JSON.stringify(perCat), JSON.stringify(failedCategories || [])]
  );

  if (process.env.ALERT_WEBHOOK && (fatalError || (failedCategories && failedCategories.length > 0))) {
    try {
      await fetch(process.env.ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ Current Affairs fetch ${status === 'error' ? 'failed' : 'partially failed'} (${day}). inserted=${totalInserted}, failed=${JSON.stringify(failedCategories)}`,
          ...(fatalError ? { error: fatalError } : {})
        })
      }).catch(() => {});
    } catch (e) {
      console.error('Alert webhook send failed:', e);
    }
  }
  return status;
}

async function fetchAndStore() {
  await ensureSchema();
  const client = await pool.connect();
  let totalInserted = 0;
  const perCat = {};
  const failedCategories = [];
  let fatalError = null;
  try {
    await client.query('BEGIN');
    for (const cat of CATEGORIES) {
      try {
        const items = await fetchCategory(cat);
        perCat[cat] = items.length;
        totalInserted += await insertItems(client, items, cat);
      } catch (catErr) {
        failedCategories.push({ category: cat, error: catErr.message });
        console.error(`CA fetch category ${cat} failed:`, catErr.message);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    fatalError = e.message;
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const reclassified = await reclassifyUncategorized();
  const status = await logFetchRun({ totalInserted, reclassified, perCat, failedCategories, fatalError });
  return { totalInserted, reclassified, perCat, failed: failedCategories, status };
}

async function getFeed({ category, month, limit = 30, offset = 0 }) {
  await ensureSchema();
  const params = [];
  const where = [];
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (month) {
    params.push(month);
    where.push(`pub_date LIKE $${params.length} || '%'`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, title, description, category, source, source_url, link, image_url, pub_date
               FROM current_affairs ${whereSql}
               ORDER BY pub_date DESC NULLS LAST, id DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit, 10) || 30, parseInt(offset, 10) || 0);
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getQuizQuestions({ category, limit = 10 }) {
  await ensureSchema();
  const params = [];
  const where = [];
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                      q.correct_option, q.explanation, q.category, c.title AS headline, c.link, c.pub_date
               FROM ca_quiz_questions q
               LEFT JOIN current_affairs c ON c.id = q.ca_item_id
               ${whereSql}
               ORDER BY q.id DESC
               LIMIT $${params.length + 1}`;
  params.push(parseInt(limit, 10) || 10);
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getStats() {
  await ensureSchema();
  const items = await pool.query('SELECT count(*) AS count FROM current_affairs');
  const quiz = await pool.query('SELECT count(*) AS count FROM ca_quiz_questions');
  const byCat = await pool.query('SELECT category, count(*) AS count FROM current_affairs GROUP BY category ORDER BY count DESC');
  const last = await pool.query('SELECT day, status, total_inserted, failed_categories FROM ca_fetch_log ORDER BY id DESC LIMIT 1');
  return {
    articles: parseInt(items.rows[0].count, 10),
    quiz_questions: parseInt(quiz.rows[0].count, 10),
    by_category: byCat.rows,
    last_fetch: last.rows[0] || null
  };
}

module.exports = { ensureSchema, fetchAndStore, getFeed, getQuizQuestions, getStats };
