const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');

// BHW Controllers
const bhwDashboardControllers = require('../controllers/bhwDashboardControllers');
const bhwNeedAttentionControllers = require('../controllers/bhwNeedAttentionControllers');
const bhwReferralsControllers = require('../controllers/bhwRefferalsControllers');
const bhwMedicalRecordsControllers = require('../controllers/bhwMedicalRecordsControllers');
const bhwScheduleControllers = require('../controllers/bhwScheduleControllers');
const bhwNotificationControllers = require('../controllers/bhwNotificationControllers');
const bhwProfileControllers = require('../controllers/bhwProfileControllers');
const nutritionCornerControllers = require('../controllers/nutritionCornerControllers');

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

let bhwUser = null;

test('BHW Full Functionality Audit', async (t) => {
  // 1. Database Connectivity & BHW Account Check
  await t.test('1. Database connectivity & Active BHW Account check', async () => {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE role = 'bhw' AND status = 'active' LIMIT 1"
    );
    assert.ok(rows.length > 0, 'At least one active BHW user must exist');
    bhwUser = rows[0];
    console.log(`✓ Active BHW user found: ID ${bhwUser.user_id}, Username: ${bhwUser.username}, Barangay: ${bhwUser.barangay}`);
  });

  // 2. BHW Dashboard
  await t.test('2. BHW Dashboard Module (/api/bhw/stats)', async () => {
    const req = {
      query: { barangay: bhwUser.barangay },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwDashboardControllers.getBhwStats(req, res);
    assert.equal(res.statusCode, 200, 'getBhwStats should return 200');
    assert.ok(res.payload.totalChildren !== undefined, 'Dashboard stats must contain totalChildren');
    console.log(`✓ BHW Dashboard Stats for ${bhwUser.barangay}: Total Children: ${res.payload.totalChildren}, Total Mothers: ${res.payload.totalMothers}`);
  });

  // 3. BHW Need Attention
  await t.test('3. BHW Need Attention Module (/api/bhw/need-attention)', async () => {
    const req = {
      query: { barangay: bhwUser.barangay },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwNeedAttentionControllers.getNeedAttention(req, res);
    assert.equal(res.statusCode, 200, 'getNeedAttention should return 200');
    const count = Array.isArray(res.payload) ? res.payload.length : (res.payload.children?.length || 0);
    console.log(`✓ BHW Need Attention: Retrieved ${count} priority beneficiaries requiring care`);
  });

  // 4. BHW Referrals
  await t.test('4. BHW Referrals Module (/api/bhw/referrals)', async () => {
    const req = {
      query: { barangay: bhwUser.barangay },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwReferralsControllers.getReferrals(req, res);
    assert.equal(res.statusCode, 200, 'getReferrals should return 200');
    const referrals = Array.isArray(res.payload) ? res.payload : (res.payload.referrals || []);
    console.log(`✓ BHW Referrals: Retrieved ${referrals.length} referrals for barangay ${bhwUser.barangay}`);
  });

  // 5. BHW Medical Records
  await t.test('5. BHW Medical Records Module (/api/bhw/medical-records/*)', async () => {
    const req = {
      query: { barangay: bhwUser.barangay },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };

    // Children Medical Records
    const resChildren = makeRes();
    await bhwMedicalRecordsControllers.getMedicalRecordsList(req, resChildren);
    assert.equal(resChildren.statusCode, 200, 'getMedicalRecordsList should return 200');
    const childrenCount = Array.isArray(resChildren.payload) ? resChildren.payload.length : (resChildren.payload.records?.length || 0);
    console.log(`✓ BHW Medical Records (Children): ${childrenCount} records loaded`);

    // Mothers Medical Records
    const resMothers = makeRes();
    await bhwMedicalRecordsControllers.getMothersList(req, resMothers);
    assert.equal(resMothers.statusCode, 200, 'getMothersList should return 200');
    const mothersCount = Array.isArray(resMothers.payload) ? resMothers.payload.length : (resMothers.payload.mothers?.length || 0);
    console.log(`✓ BHW Medical Records (Mothers): ${mothersCount} records loaded`);

    // Audit Trail
    const resAudit = makeRes();
    await bhwMedicalRecordsControllers.getMedicalRecordsAuditTrail(req, resAudit);
    assert.equal(resAudit.statusCode, 200, 'getMedicalRecordsAuditTrail should return 200');
    console.log(`✓ BHW Medical Records Audit Trail accessible`);
  });

  // 6. BHW Nutrition Corner (Scoped to BHW Barangay)
  await t.test('6. BHW Nutrition Corner Module (/api/nutrition-corner/*)', async () => {
    const reqCons = {
      query: { year: 2026, barangay: bhwUser.barangay },
      user: { role: 'bhw', barangay: bhwUser.barangay }
    };
    const resCons = makeRes();
    await nutritionCornerControllers.getConsolidation(reqCons, resCons);
    assert.equal(resCons.statusCode, 200, 'getConsolidation should return 200');
    console.log(`✓ Nutrition Corner Consolidation for BHW barangay ${bhwUser.barangay} loaded`);

    const reqProg = { query: {}, user: { role: 'bhw', barangay: bhwUser.barangay } };
    const resProg = makeRes();
    await nutritionCornerControllers.getPrograms(reqProg, resProg);
    assert.equal(resProg.statusCode, 200, 'getPrograms should return 200');
    console.log(`✓ Nutrition Corner Programs accessible to BHW`);
  });

  // 7. BHW Schedule & Activities
  await t.test('7. BHW Schedule Module (/api/bhw/schedule)', async () => {
    const req = {
      query: { barangay: bhwUser.barangay, user_id: bhwUser.user_id },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwScheduleControllers.getBhwSchedules(req, res);
    assert.equal(res.statusCode, 200, 'getBhwSchedules should return 200');
    const schedules = Array.isArray(res.payload) ? res.payload : (res.payload.schedules || []);
    console.log(`✓ BHW Schedule: ${schedules.length} activities scheduled for ${bhwUser.barangay}`);
  });

  // 8. BHW Notifications
  await t.test('8. BHW Notifications Module (/api/bhw/notifications)', async () => {
    const req = {
      query: {},
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwNotificationControllers.getNotifications(req, res);
    assert.equal(res.statusCode, 200, 'getNotifications should return 200');
    console.log(`✓ BHW Notifications retrieved successfully`);
  });

  // 9. BHW Profile & Settings
  await t.test('9. BHW Profile Module (/api/bhw/profile/me)', async () => {
    const req = {
      params: { id: 'me' },
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    const res = makeRes();
    await bhwProfileControllers.getProfile(req, res);
    assert.equal(res.statusCode, 200, 'getProfile should return 200');
    console.log(`✓ BHW Profile: ${res.payload.first_name} ${res.payload.last_name} (${res.payload.barangay})`);
  });

  // 10. BHW Barangay Scoping & Privacy Enforcement
  await t.test('10. BHW Privacy & Barangay Scope Enforcement', async () => {
    const { canAccessProfile } = require('../utils/roleAccess');
    // BHW cannot view another barangay BHW or unassociated profile
    const fakeReq = {
      user: { user_id: bhwUser.user_id, role: 'bhw', barangay: bhwUser.barangay },
    };
    // Cannot access random admin or other barangay user ID
    const canAccessOther = canAccessProfile(fakeReq, 999999);
    assert.equal(canAccessOther, false, 'BHW must not be allowed to access unauthorized profiles');
    console.log(`✓ BHW Barangay Scoping & Access Control verified`);
  });
});
