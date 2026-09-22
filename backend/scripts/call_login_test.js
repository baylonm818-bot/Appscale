require('dotenv').config();
const auth = require('../controllers/authController');

const req = { body: { email: 'admin@apscale.local', password: '12345678' }, headers: {} };
const res = {
  status(code) { this.statusCode = code; return this; },
  json(obj) { console.log('RESPONSE', this.statusCode || 200, JSON.stringify(obj)); }
};

(async () => {
  try {
    await auth.login(req, res);
  } catch (err) {
    console.error('CALL LOGIN TEST ERROR', err && err.stack);
  }
})();
