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

test('login rejects a non-existent admin alias with a generic invalid-credentials response', async () => {
  const req = { body: { email: 'admin@example.com', password: '12345678' }, headers: {} };
  const res = makeRes();

  await authController.login(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.message, 'Invalid email or password.');
});

test('admin account locks after repeated failed login attempts', async () => {
  const pool = require('../config/db');
  const bcrypt = require('bcrypt');
  const originalQuery = pool.query;
  const passwordHash = await bcrypt.hash('correct-password', 10);

  const user = {
    user_id: 99,
    username: 'admin.locktest',
    email: 'locktest@apscale.local',
    password_hash: passwordHash,
    first_name: 'Lock',
    last_name: 'Tester',
    role: 'admin',
    status: 'active',
    failed_attempts: 0,
    barangay: 'Barangay 1',
    municipality: 'Municipality 1',
    profile_picture: null,
    deleted_at: null,
  };

  let queryCalls = 0;
  pool.query = async (sql, params) => {
    queryCalls += 1;
    if (sql.includes('SELECT * FROM users')) {
      return [[user]];
    }
    if (sql.includes('UPDATE users SET failed_attempts')) {
      const values = Array.isArray(params) ? params : [];
      user.failed_attempts = values[0];
      if (values.length >= 4) {
        user.status = values[1];
      }
      return [{ affectedRows: 1 }];
    }
    return [[{ ok: true }]];
  };

  try {
    const first = makeRes();
    await authController.login({ body: { email: user.email, password: 'wrong-pass-1' } }, first);
    assert.equal(first.statusCode, 401);

    const second = makeRes();
    await authController.login({ body: { email: user.email, password: 'wrong-pass-2' } }, second);
    assert.equal(second.statusCode, 429);
    assert.match(second.payload.message, /Please wait 30 second\(s\) before trying again\./);
  } finally {
    pool.query = originalQuery;
  }
});
