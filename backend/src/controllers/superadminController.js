const { listAdmins, createAdmin, removeAdmin } = require('../services/superadminService');

const getAdmins = async (req, res) => {
  try {
    res.json(await listAdmins());
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
};

const addAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const admin = await createAdmin({ name, email, password });
    res.status(201).json(admin);
  } catch (error) {
    console.error('Create admin error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Failed to create admin' });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove your own account' });
    }
    const result = await removeAdmin(id);
    res.json(result);
  } catch (error) {
    console.error('Remove admin error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Failed to remove admin' });
  }
};

module.exports = { getAdmins, addAdmin, deleteAdmin };
