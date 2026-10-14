const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const pool = require('../config/db');

function makeRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

test('A8: Admin token is rejected with 403 on child, mother, and nutrition mutations', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { user_id: 1, role: 'admin' };
    next();
  });
  app.use('/api/mobile', require('../routes/mobileBeneficiaryRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const resChild = await makeRequest(server, {
      port,
      path: '/api/mobile/children',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { first_name: 'Test', birth_date: '2025-01-01', barangay: 'Antipolo' });

    assert.equal(resChild.status, 403, 'Admin must receive 403 on creating children');

    const resMother = await makeRequest(server, {
      port,
      path: '/api/mobile/mothers',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { first_name: 'MotherTest', barangay: 'Antipolo' });

    assert.equal(resMother.status, 403, 'Admin must receive 403 on creating mothers');

    const resNutrition = await makeRequest(server, {
      port,
      path: '/api/mobile/nutrition-records',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { child_id: 1, record_date: '2026-01-01', weight_kg: 10, height_cm: 80 });

    assert.equal(resNutrition.status, 403, 'Admin must receive 403 on creating nutrition records');
  } finally {
    server.close();
  }
});

test('B9 & C4: BHW token is rejected with 403 on creating referrals (BNS only)', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { user_id: 7, role: 'bhw', barangay: 'Antipolo', status: 'active' };
    next();
  });
  app.use('/api/bhw/referrals', require('../routes/bhwReferralsRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const resRef = await makeRequest(server, {
      port,
      path: '/api/bhw/referrals',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { child_id: 1, reason: 'Underweight', barangay: 'Antipolo' });

    assert.equal(resRef.status, 403, 'BHW must receive 403 on referral creation');
  } finally {
    server.close();
  }
});

test('A9: Admin can edit and delete schedules via PUT and DELETE endpoints', async () => {
  // Insert a test schedule
  const [insertRes] = await pool.query(
    `INSERT INTO schedules (title, schedule_type, schedule_date, barangay, status, created_by)
     VALUES ('Test Admin Edit Schedule', 'Meeting', '2026-11-01', 'Antipolo', 'pending', 1)`
  );
  const schedId = insertRes.insertId;

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { user_id: 1, role: 'admin' };
    next();
  });
  app.use('/api/schedule', require('../routes/scheduleRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Edit schedule
    const resEdit = await makeRequest(server, {
      port,
      path: `/api/schedule/${schedId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }, {
      title: 'Updated Schedule Title',
      schedule_type: 'Workshop',
      schedule_date: '2026-11-02',
      venue: 'Municipal Hall',
      barangay: 'Antipolo',
    });

    assert.equal(resEdit.status, 200, 'Admin can update schedule details');

    const [[updatedRow]] = await pool.query('SELECT title, schedule_type FROM schedules WHERE schedule_id = ?', [schedId]);
    assert.equal(updatedRow.title, 'Updated Schedule Title');
    assert.equal(updatedRow.schedule_type, 'Workshop');

    // 2. Delete schedule
    const resDelete = await makeRequest(server, {
      port,
      path: `/api/schedule/${schedId}`,
      method: 'DELETE',
    });

    assert.equal(resDelete.status, 200, 'Admin can delete schedule');

    const [[checkDeleted]] = await pool.query('SELECT schedule_id FROM schedules WHERE schedule_id = ?', [schedId]);
    assert.equal(checkDeleted, undefined, 'Schedule must be deleted from DB');
  } finally {
    server.close();
    await pool.query('DELETE FROM schedules WHERE schedule_id = ?', [schedId]).catch(() => {});
  }
});
