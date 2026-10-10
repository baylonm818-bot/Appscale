const test = require('node:test');
const assert = require('node:assert/strict');
const bhwScheduleController = require('../controllers/bhwScheduleControllers');
const bhwNotificationController = require('../controllers/bhwNotificationControllers');
const { canAccessSchedule } = require('../utils/roleAccess');
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

test('BHW notifications are filtered to the logged-in barangay', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('SELECT notification_id, title, message, type, is_read, created_at')) {
      return [[{
        notification_id: 101,
        title: 'Barangay 1 update',
        message: 'Test for Barangay 1',
        type: 'schedule',
        is_read: false,
        created_at: '2026-09-29T00:00:00Z'
      }]];
    }

    if (sql.includes('COUNT(*) AS unreadCount')) {
      return [[{ unreadCount: 1 }]];
    }

    return [[{ ok: true }]];
  };

  try {
    const req = {
      user: { role: 'bhw', barangay: 'Barangay 1' }
    };
    const res = makeRes();

    await bhwNotificationController.getNotifications(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.notifications.length, 1);
    assert.ok(calls.some((call) => call.sql.toLowerCase().includes('barangay') && call.params && call.params.includes('Barangay 1')));
  } finally {
    pool.query = originalQuery;
  }
});

test('BHW schedule access allows all-barangay records for the same-role audience', () => {
  const requester = { role: 'bhw', barangay: 'Barangay 1' };
  const schedule = { barangay: 'All Barangays', target_role: 'bhw' };

  assert.equal(canAccessSchedule(requester, schedule), true);
});

test('BHW schedule query includes all-barangay scope when fetching user schedules', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return [[{ schedule_id: 1 }]];
  };

  try {
    const req = { user: { role: 'bhw', barangay: 'Barangay 1' } };
    const res = makeRes();

    await bhwScheduleController.getBhwSchedules(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(calls.some((call) => call.sql.includes("barangay = 'All Barangays'")));
  } finally {
    pool.query = originalQuery;
  }
});

test('shared notification controller filters system sync rows without invalid table alias usage', async () => {
  const notificationController = require('../controllers/notificationControllers');
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('COUNT(*) AS unreadCount')) {
      return [[{ unreadCount: 1 }]];
    }

    return [[{
      notification_id: 5,
      title: 'Vaccination Day',
      message: 'Barangay activity',
      type: 'schedule',
      is_read: false,
      created_at: '2026-09-29T00:00:00Z'
    }]];
  };

  try {
    const req = { user: { role: 'bhw' } };
    const res = makeRes();

    await notificationController.getNotifications(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.notifications.length, 1);
    assert.ok(calls.some((call) => call.sql.includes('FROM notifications n')));
    assert.ok(!calls.some((call) => call.sql.includes('n.type <>') && !call.sql.includes('FROM notifications n')));
  } finally {
    pool.query = originalQuery;
  }
});
