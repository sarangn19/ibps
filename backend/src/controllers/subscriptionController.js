const {
  getAccessForUser,
  subscribeMonthly,
  grantFree,
  revokeGrant,
  listStudents
} = require('../services/subscriptionService');

const getMySubscription = async (req, res) => {
  try {
    res.json(await getAccessForUser(req.user.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch subscription' });
  }
};

const subscribe = async (req, res) => {
  try {
    res.json(await subscribeMonthly(req.user.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Subscription failed' });
  }
};

const listSubscriptions = async (req, res) => {
  try {
    res.json(await listStudents());
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

const grantSubscription = async (req, res) => {
  try {
    const { user_id, duration_days } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    if (Number(user_id) === req.user.id) {
      return res.status(400).json({ error: 'You already have free access as staff' });
    }
    const access = await grantFree(user_id, duration_days, req.user.id);
    res.json({ success: true, access });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to grant free subscription' });
  }
};

const revokeSubscription = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const access = await revokeGrant(user_id);
    res.json({ success: true, access });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to revoke free subscription' });
  }
};

module.exports = { getMySubscription, subscribe, listSubscriptions, grantSubscription, revokeSubscription };
