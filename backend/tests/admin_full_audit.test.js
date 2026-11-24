const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');

// Controllers
const authController = require('../controllers/authController');
const dashboardControllers = require('../controllers/dashboardControllers');
const userControllers = require('../controllers/userControllers');
const masterlistControllers = require('../controllers/masterlistControllers');
const nutritionCornerControllers = require('../controllers/nutritionCornerControllers');
const scheduleControllers = require('../controllers/scheduleControllers');
const adminLogControllers = require('../controllers/adminLogControllers');
const reportControllers = require('../controllers/reportControllers');
const profileControllers = require('../controllers/profileControllers');
const purokControllers = require('../controllers/purokControllers');
const notificationControllers = require('../controllers/notificationControllers');

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

let adminUser = null;

test('Admin Full Functionality Audit', async (t) => {
  // 1. Database Connectivity & Admin User lookup
  await t.test('1. Database connectivity & Admin Account check', async () => {
    const [rows] = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    assert.ok(rows.length > 0, 'At least one admin user must exist in the database');
    adminUser = rows[0];
    console.log(`✓ Admin user found: ID ${adminUser.user_id}, Username: ${adminUser.username}, Email: ${adminUser.email}`);
  });

  // 2. Authentication & Login
  await t.test('2. Authentication & Login (/api/auth/login)', async () => {
    const reqEmpty = { body: {}, headers: {} };
    const resEmpty = makeRes();
    await authController.login(reqEmpty, resEmpty);
    assert.equal(resEmpty.statusCode, 400, 'Empty login should return 400');

    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare('12345678', adminUser.password_hash);
    console.log(`✓ Admin password hash validation: ${isPasswordValid ? 'matches canonical 12345678' : 'custom password set'}`);
  });

  // 3. Dashboard Endpoints
  await t.test('3. Dashboard Module (/api/dashboard/*)', async () => {
    const adminReq = { user: { role: 'admin', user_id: adminUser.user_id }, query: {} };

    // Stats
    const resStats = makeRes();
    await dashboardControllers.getAdminStats(adminReq, resStats);
    assert.equal(resStats.statusCode, 200, 'getAdminStats should return 200');
    assert.ok(resStats.payload.totalChildren !== undefined, 'getAdminStats must contain totalChildren');
    console.log(`✓ Dashboard Stats: Total Children: ${resStats.payload.totalChildren}, Total Mothers: ${resStats.payload.totalMothers}`);

    // Feeding Stats
    const resFeeding = makeRes();
    await dashboardControllers.getFeedingStats(adminReq, resFeeding);
    assert.equal(resFeeding.statusCode, 200, 'getFeedingStats should return 200');
    console.log(`✓ Dashboard Feeding Stats: ${JSON.stringify(resFeeding.payload)}`);

    // Yearly Nutrition
    const resYearly = makeRes();
    await dashboardControllers.getNutritionByYear(adminReq, resYearly);
    assert.equal(resYearly.statusCode, 200, 'getNutritionByYear should return 200');
    console.log(`✓ Dashboard Yearly Nutrition entries count: ${Array.isArray(resYearly.payload) ? resYearly.payload.length : 'OK'}`);

    // Need Attention
    const resAttention = makeRes();
    await dashboardControllers.getAdminNeedAttention(adminReq, resAttention);
    assert.equal(resAttention.statusCode, 200, 'getAdminNeedAttention should return 200');
    console.log(`✓ Dashboard Need Attention count: ${Array.isArray(resAttention.payload) ? resAttention.payload.length : 'OK'}`);
  });

  // 4. User Management
  await t.test('4. User Management Module (/api/users/*)', async () => {
    const adminReq = { user: { role: 'admin', user_id: adminUser.user_id }, query: {} };

    // Get Users
    const resUsers = makeRes();
    await userControllers.getUsers(adminReq, resUsers);
    assert.equal(resUsers.statusCode, 200, 'getUsers should return 200');
    assert.ok(Array.isArray(resUsers.payload), 'getUsers should return an array');
    console.log(`✓ User Management: Retrieved ${resUsers.payload.length} total users`);

    // User Stats
    const resUserStats = makeRes();
    await userControllers.getUserStats(adminReq, resUserStats);
    assert.equal(resUserStats.statusCode, 200, 'getUserStats should return 200');
    console.log(`✓ User Management Stats: ${JSON.stringify(resUserStats.payload)}`);
  });

  // 5. Master List
  await t.test('5. Master List Module (/api/masterlist/*)', async () => {
    const adminReq = { user: { role: 'admin' }, query: { page: 1, limit: 10 } };

    // Stats
    const resStats = makeRes();
    await masterlistControllers.getMasterlistStats(adminReq, resStats);
    assert.equal(resStats.statusCode, 200, 'getMasterlistStats should return 200');
    console.log(`✓ Masterlist Stats: ${JSON.stringify(resStats.payload)}`);

    // Children
    const resChildren = makeRes();
    await masterlistControllers.getChildren(adminReq, resChildren);
    assert.equal(resChildren.statusCode, 200, 'getChildren should return 200');
    console.log(`✓ Masterlist Children count: ${resChildren.payload.children ? resChildren.payload.children.length : resChildren.payload.length}`);

    // Mothers
    const resMothers = makeRes();
    await masterlistControllers.getMothers(adminReq, resMothers);
    assert.equal(resMothers.statusCode, 200, 'getMothers should return 200');
    console.log(`✓ Masterlist Mothers count: ${resMothers.payload.mothers ? resMothers.payload.mothers.length : resMothers.payload.length}`);

    // Barangays
    const resBarangays = makeRes();
    await masterlistControllers.getBarangays(adminReq, resBarangays);
    assert.equal(resBarangays.statusCode, 200, 'getBarangays should return 200');
    console.log(`✓ Masterlist Barangays count: ${resBarangays.payload.length}`);
  });

  // 6. Nutrition Corner
  await t.test('6. Nutrition Corner Module (/api/nutrition-corner/*)', async () => {
    // Consolidation
    const reqCons = { query: { year: 2026, barangay: 'All' } };
    const resCons = makeRes();
    await nutritionCornerControllers.getConsolidation(reqCons, resCons);
    assert.equal(resCons.statusCode, 200, 'getConsolidation should return 200');
    console.log(`✓ Nutrition Corner Consolidation loaded for 2026 (All Barangays)`);

    // Monthly Monitoring
    const reqMon = { query: { year: 2026 } };
    const resMon = makeRes();
    await nutritionCornerControllers.getMonthlyMonitoring(reqMon, resMon);
    assert.equal(resMon.statusCode, 200, 'getMonthlyMonitoring should return 200');
    console.log(`✓ Nutrition Corner Monthly Monitoring loaded (${resMon.payload.matrix ? resMon.payload.matrix.length : resMon.payload.length} records)`);

    // Programs
    const reqProg = { query: {} };
    const resProg = makeRes();
    await nutritionCornerControllers.getPrograms(reqProg, resProg);
    assert.equal(resProg.statusCode, 200, 'getPrograms should return 200');
    console.log(`✓ Nutrition Corner Programs count: ${resProg.payload.length}`);

    // Laws
    const resLaws = makeRes();
    await nutritionCornerControllers.getLaws(reqProg, resLaws);
    assert.equal(resLaws.statusCode, 200, 'getLaws should return 200');
    console.log(`✓ Nutrition Corner Laws count: ${resLaws.payload.length}`);
  });

  // 7. Schedules & Activities
  await t.test('7. Schedules Module (/api/schedules/*)', async () => {
    const adminReq = { user: { role: 'admin', user_id: adminUser.user_id }, query: {} };

    // Stats
    const resStats = makeRes();
    await scheduleControllers.getScheduleStats(adminReq, resStats);
    assert.equal(resStats.statusCode, 200, 'getScheduleStats should return 200');
    console.log(`✓ Schedule Stats: ${JSON.stringify(resStats.payload)}`);

    // List
    const resList = makeRes();
    await scheduleControllers.getSchedules(adminReq, resList);
    assert.equal(resList.statusCode, 200, 'getSchedules should return 200');
    console.log(`✓ Schedules count: ${resList.payload.length}`);
  });

  // 8. System Activity Logs
  await t.test('8. System Logs Module (/api/logs)', async () => {
    const adminReq = { user: { role: 'admin' }, query: { limit: 10, page: 1 } };
    const resLogs = makeRes();
    await adminLogControllers.getSystemLogs(adminReq, resLogs);
    assert.equal(resLogs.statusCode, 200, 'getSystemLogs should return 200');
    console.log(`✓ System Activity Logs retrieved: ${resLogs.payload.logs ? resLogs.payload.logs.length : resLogs.payload.length} entries`);
  });

  // 9. Signatories
  await t.test('9. Signatories Module (/api/reports/signatories)', async () => {
    const adminReq = { user: { role: 'admin' }, query: {} };
    const resSig = makeRes();
    await reportControllers.getSignatories(adminReq, resSig);
    assert.equal(resSig.statusCode, 200, 'getSignatories should return 200');
    console.log(`✓ Signatories retrieved: Municipal & Barangay configurations loaded`);
  });

  // 10. Settings & Profile
  await t.test('10. Profile & Settings Module (/api/profile/me)', async () => {
    const adminReq = {
      params: { id: 'me' },
      user: { user_id: adminUser.user_id, role: 'admin' }
    };
    const resProf = makeRes();
    await profileControllers.getProfile(adminReq, resProf);
    assert.equal(resProf.statusCode, 200, 'getProfile should return 200');
    console.log(`✓ Profile loaded: ${resProf.payload.first_name} ${resProf.payload.last_name} (${resProf.payload.email})`);
  });

  // 11. Puroks
  await t.test('11. Purok Management Module (/api/puroks)', async () => {
    const reqPurok = { query: {} };
    const resPurok = makeRes();
    await purokControllers.getPuroks(reqPurok, resPurok);
    assert.equal(resPurok.statusCode, 200, 'getPuroks should return 200');
    console.log(`✓ Puroks retrieved: ${resPurok.payload.length} records`);
  });

  // 12. Notifications
  await t.test('12. Notifications Module (/api/notifications)', async () => {
    const adminReq = { user: { user_id: adminUser.user_id, role: 'admin' }, query: {} };
    const resNotif = makeRes();
    await notificationControllers.getNotifications(adminReq, resNotif);
    assert.equal(resNotif.statusCode, 200, 'getNotifications should return 200');
    console.log(`✓ Notifications count: ${resNotif.payload.notifications ? resNotif.payload.notifications.length : resNotif.payload.length}`);
  });
});
