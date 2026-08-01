const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const testRoutes = require('./routes/tests');
const attemptRoutes = require('./routes/attempts');
const practiceRoutes = require('./routes/practice');
const masteryRoutes = require('./routes/mastery');
const adminRoutes = require('./routes/admin');
const { getMyHistory } = require('./controllers/attemptController');
const { getSubjects } = require('./controllers/questionController');
const { auth } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/mastery', masteryRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/attempts/my-history', auth, getMyHistory);
app.get('/api/questions/subjects/tree', auth, getSubjects);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'IBPS Coaching API is running' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'IBPS Coaching API is running' });
});

module.exports = app;
