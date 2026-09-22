const test = require('node:test');
const assert = require('node:assert/strict');
const authController = require('../controllers/authController');

function makeRes() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('login accepts the canonical admin account for the project', async () => {
  const req = { body: { email: 'admin@apscale.local', password: '12345678' }, headers: {} };
  const res = makeRes();

  await authController.login(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.payload && res.payload.token, 'token should be present');
  assert.equal(res.payload.user.role, 'admin');
});

test('login accepts the legacy admin alias with the canonical admin password', async () => {
  const req = { body: { email: 'admin@example.com', password: '12345678' }, headers: {} };
  const res = makeRes();

  await authController.login(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.payload && res.payload.token, 'token should be present');
  assert.equal(res.payload.user.role, 'admin');
});
