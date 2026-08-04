const { fetchAndStore, getFeed, getQuizQuestions, getStats } = require('../services/caService');

const runFetch = async (req, res) => {
  try {
    const result = await fetchAndStore();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('CA fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch current affairs', detail: error.message });
  }
};

// Secured entry point for the Vercel Cron Job (GET /api/ca/fetch-daily). Vercel
// sends `Authorization: Bearer $CRON_SECRET`; reject anything that doesn't match
// so the fetch can't be triggered by anonymous callers.
const runDailyFetch = async (req, res) => {
  const authHeader = req.header('Authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await fetchAndStore();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('CA daily fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch current affairs', detail: error.message });
  }
};

const listFeed = async (req, res) => {
  try {
    const rows = await getFeed({
      category: req.query.category,
      month: req.query.month,
      limit: req.query.limit,
      offset: req.query.offset
    });
    res.json({ articles: rows });
  } catch (error) {
    console.error('CA feed error:', error);
    res.status(500).json({ error: 'Failed to load current affairs' });
  }
};

const listQuiz = async (req, res) => {
  try {
    const rows = await getQuizQuestions({
      category: req.query.category,
      limit: req.query.limit
    });
    res.json({ questions: rows });
  } catch (error) {
    console.error('CA quiz error:', error);
    res.status(500).json({ error: 'Failed to load quiz questions' });
  }
};

const stats = async (req, res) => {
  try {
    res.json(await getStats());
  } catch (error) {
    console.error('CA stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
};

module.exports = { runFetch, runDailyFetch, listFeed, listQuiz, stats };
