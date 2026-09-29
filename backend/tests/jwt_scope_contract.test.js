const assert = require('node:assert/strict');
const authController = require('../controllers/authController');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

(async () => {
  const originalQuery = pool.query;
  const originalCompare = bcrypt.compare;
  const originalSign = jwt.sign;

  let capturedPayload;

  try {
    pool.query = async () => [[{
      user_id: 42,
      username: 'bea',
      first_name: 'Bea',
      last_name: 'Santos',
      role: 'bhw',
      barangay: 'Barangay 1',
      municipality: 'Municipality A',
      profile_picture: null,
      status: 'active',
      password_hash: 'hashed-password',
      failed_attempts: 0,
    }]];

    bcrypt.compare = async () => true;
    jwt.sign = (...args) => {
      capturedPayload = args[0];
      return 'fake-token';
    };

    const req = { body: { email: 'bea@example.com', password: 'secret123' } };
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await authController.login(req, res);

    assert.equal(res.code, 200, 'login should succeed');
    assert.equal(capturedPayload.barangay, 'Barangay 1', 'JWT payload must include assigned barangay for BHW access');
    assert.equal(capturedPayload.municipality, 'Municipality A', 'JWT payload should include municipality context');
    assert.equal(res.body.user.barangay, 'Barangay 1', 'login response should send barangay to the frontend');
    console.log('jwt_scope_contract.test: PASS');
  } catch (error) {
    console.error('jwt_scope_contract.test: FAIL');
    console.error(error);
    process.exitCode = 1;
  } finally {
    pool.query = originalQuery;
    bcrypt.compare = originalCompare;
    jwt.sign = originalSign;
  }
})();
