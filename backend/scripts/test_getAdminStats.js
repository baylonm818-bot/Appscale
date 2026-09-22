const { getAdminStats } = require('../controllers/dashboardControllers');

const req = {
  user: { user_id: 1, username: 'adminCadag', role: 'admin' },
  query: { range: '3M' }
};

const res = {
  status(code) { this._code = code; return this; },
  json(obj) { console.log('Response status:', this._code || 200); console.log('Response body:', JSON.stringify(obj, null, 2)); }
};

getAdminStats(req, res).catch(err => {
  console.error('Unhandled error from getAdminStats:', err && (err.stack || err));
});
