const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const testRoutes = require('./routes/tests');
const attemptRoutes = require('./routes/attempts');
const practiceRoutes = require('./routes/practice');
const masteryRoutes = require('./routes/mastery');
const adminRoutes = require('./routes/admin');
const caRoutes = require('./routes/ca');
const superadminRoutes = require('./routes/superadmin');
const subscriptionRoutes = require('./routes/subscription');
const revisionRoutes = require('./routes/revision');
const { getMyHistory } = require('./controllers/attemptController');
const { getSubjects } = require('./controllers/questionController');
const { auth } = require('./middleware/auth');
const { ensureSchema: ensureSuperadminSchema } = require('./services/superadminService');
const { ensureSchema: ensureSubscriptionSchema } = require('./services/subscriptionService');
const { ensureSchema: ensureRevisionSchema } = require('./controllers/revisionController');
const { ensurePasswordResetSchema } = require('./controllers/authController');

const app = express();

app.use(cors());
app.use(express.json());

// Self-migrating: widen users.role CHECK to allow superadmin and bootstrap the
// first admin as superadmin. Runs on boot so deploys apply automatically.
ensureSuperadminSchema().catch(err => console.error('Superadmin schema init failed:', err));
ensureSubscriptionSchema().catch(err => console.error('Subscription schema init failed:', err));
ensureRevisionSchema().catch(err => console.error('Revision schema init failed:', err));
ensurePasswordResetSchema().catch(err => console.error('Password reset schema init failed:', err));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/mastery', masteryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ca', caRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/revision', revisionRoutes);

app.get('/api/attempts/my-history', auth, getMyHistory);
app.get('/api/questions/subjects/tree', auth, getSubjects);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'IBPS Coaching API is running' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'IBPS Coaching API is running' });
});

module.exports = app;
