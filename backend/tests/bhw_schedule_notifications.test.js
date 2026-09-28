const test = require('node:test');
const assert = require('node:assert/strict');
const bhwScheduleController = require('../controllers/bhwScheduleControllers');
const pool = require('../config/db');

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

test('marking a BHW schedule as done creates an admin notification', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes("UPDATE schedules SET status = 'done'")) {
      return [{ affectedRows: 1 }];
    }

    if (sql.includes('SELECT title, barangay FROM schedules')) {
      return [[{ title: 'Clean-up Drive', barangay: 'Barangay 1' }]];
    }

    if (sql.includes('INSERT INTO notifications')) {
      return [{ insertId: 2001 }];
    }

    return [[{ ok: true }]];
  };

  try {
    const req = { params: { id: 7 } };
    const res = makeRes();

    await bhwScheduleController.markScheduleDone(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(calls.some((call) => call.sql.includes('INSERT INTO notifications')));
    assert.ok(calls.some((call) => call.sql.includes('SELECT title, barangay FROM schedules')));
  } finally {
    pool.query = originalQuery;
  }
});

test('updating a BHW schedule status to done creates an admin notification', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('UPDATE schedules SET status = ?')) {
      return [{ affectedRows: 1 }];
    }

    if (sql.includes('SELECT title, barangay FROM schedules')) {
      return [[{ title: 'Vaccination Day', barangay: 'Barangay 2' }]];
    }

    if (sql.includes('INSERT INTO notifications')) {
      return [{ insertId: 2002 }];
    }

    return [[{ ok: true }]];
  };

  try {
    const req = {
      params: { id: 8 },
      body: { status: 'done' },
    };
    const res = makeRes();

    await bhwScheduleController.updateBhwScheduleStatus(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(calls.some((call) => call.sql.includes('INSERT INTO notifications')));
  } finally {
    pool.query = originalQuery;
  }
});
