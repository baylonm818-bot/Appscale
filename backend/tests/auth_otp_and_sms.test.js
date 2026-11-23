const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const authController = require('../controllers/authController');
const { maskPhoneNumber, normalizePhilippinePhone, sendVerificationSms } = require('../services/smsService');

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

test('SMS service correctly normalizes Philippine numbers and masks them', () => {
  assert.equal(normalizePhilippinePhone('09661234526'), '09661234526');
  assert.equal(normalizePhilippinePhone('+639661234526'), '09661234526');
  assert.equal(normalizePhilippinePhone('639661234526'), '09661234526');
  assert.equal(normalizePhilippinePhone('9661234526'), '09661234526');

  assert.equal(maskPhoneNumber('09661234526'), '0966*****26');
  assert.equal(maskPhoneNumber('+639175551234'), '0917*****34');
});

test('checkAccount returns masked phone for accounts with contact numbers', async () => {
  const pool = require('../config/db');
  const originalQuery = pool.query;

  const testUser = {
    user_id: 42,
    role: 'bns',
    first_name: 'Juana',
    last_name: 'Dela Cruz',
    email: 'bns@apscale.local',
    contact_number: '09661234526',
  };

  pool.query = async (sql, params) => {
    if (sql.includes('SELECT user_id')) {
      return [[testUser]];
    }
    return [[{ ok: true }]];
  };

  try {
    const req = { query: { email: 'bns@apscale.local', platform: 'mobile' } };
    const res = makeRes();

    await authController.checkAccount(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.exists, true);
    assert.equal(res.payload.has_sms, true);
    assert.equal(res.payload.masked_phone, '0966*****26');
  } finally {
    pool.query = originalQuery;
  }
});

test('forgotPassword returns generic message and allows OTP verification then password reset', async () => {
  const pool = require('../config/db');
  const originalQuery = pool.query;

  const oldPasswordHash = await bcrypt.hash('old-password-123', 10);
  const testUser = {
    user_id: 55,
    role: 'bns',
    first_name: 'Juana',
    last_name: 'BNS',
    email: 'testuser@apscale.local',
    password_hash: oldPasswordHash,
    contact_number: '09171234567',
  };

  let updatedPasswordHash = null;

  pool.query = async (sql, params) => {
    if (sql.includes('SELECT * FROM users')) {
      return [[testUser]];
    }
    if (sql.includes('UPDATE users SET password_hash')) {
      updatedPasswordHash = params[0];
      return [{ affectedRows: 1 }];
    }
    return [[{ ok: true }]];
  };

  try {
    // 1. Request OTP
    const forgotReq = {
      body: { email: testUser.email, platform: 'mobile', channel: 'sms' },
      headers: {},
    };
    const forgotRes = makeRes();

    await authController.forgotPassword(forgotReq, forgotRes);

    assert.equal(forgotRes.statusCode, 200);
    assert.equal(forgotRes.payload.message, 'If this account exists, a code has been sent.');
    assert.equal(forgotRes.payload.channel, 'sms');
    assert.equal(forgotRes.payload.masked_recipient, '0917*****67');

    // 2. Reject incorrect OTP
    const wrongVerifyReq = {
      body: { email: testUser.email, otp: '000000' },
      headers: {},
    };
    const wrongVerifyRes = makeRes();

    await authController.verifyOtp(wrongVerifyReq, wrongVerifyRes);

    assert.equal(wrongVerifyRes.statusCode, 400);
    assert.equal(wrongVerifyRes.payload.message, 'Incorrect or expired code.');
  } finally {
    pool.query = originalQuery;
  }
});
