const assert = require('assert');
const pool = require('../config/db');
const mobileController = require('../controllers/mobileBeneficiaryControllers');

// This is a lightweight integration test that queries the DB and verifies
// that schedules returned by getMobileSchedules include only visible schedules
// for a sample user. It does not start the HTTP server.

async function run() {
  // Create a fake request/response
  const req = {
    user: { user_id: 9999, role: 'bns' },
    query: { barangay: 'Gasan' },
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };

  try {
    await mobileController.getMobileSchedules(req, res);
    const schedules = Array.isArray(res.body) ? res.body : (res.body && res.body.schedules) || [];
    // Verify each schedule has a targets array and visibility rules satisfied
    for (const s of schedules) {
      assert.ok(Array.isArray(s.targets), 'schedule.targets must be present');
      const hasGlobal = s.targets.some(t => t.type === 'global');
      const hasBarangay = s.targets.some(t => t.type === 'barangay' && t.value && t.value.toLowerCase() === 'gasan');
      const hasUser = s.targets.some(t => t.type === 'user' && String(t.value) === String(req.user.user_id));
      assert.ok(hasGlobal || hasBarangay || hasUser, `Schedule ${s.schedule_id} should be visible to the requester`);
    }
    console.log('Schedule visibility test: OK');
  } catch (err) {
    console.error('Schedule visibility test failed:', err && err.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

if (require.main === module) run();

module.exports = run;
