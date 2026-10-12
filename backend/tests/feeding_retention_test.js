const assert = require('assert');
const pool = require('../config/db');
const {
  upsertProgramEnrollment,
  unenrollProgramBeneficiary,
  getEnrollmentHistory,
  blockHardDeleteEnrollment,
} = require('../controllers/mobileBeneficiaryControllers');

function mockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('--- Running Feeding Program Retention & Zero Data Loss Tests ---');

  const testChildExtId = 'test_child_retention_' + Date.now();
  const testBarangay = 'TestBrgyRetention';
  let enrollmentId = null;

  try {
    // 1. Test Initial Enrollment
    console.log('1. Testing Enroll beneficiary...');
    const enrollReq = {
      user: { user_id: 1, role: 'admin', barangay: null },
      body: {
        child_external_id: testChildExtId,
        beneficiary_name: 'Retention Test Baby',
        barangay: testBarangay,
        status: 'enrolled',
        notes: 'Initial enrollment test',
      },
    };
    const enrollRes = mockRes();
    await upsertProgramEnrollment(enrollReq, enrollRes);

    assert.strictEqual(enrollRes.statusCode, 201, `Enroll status code should be 201, got ${enrollRes.statusCode}`);
    assert.ok(enrollRes.data.enrollment_id, 'Should return enrollment_id');
    enrollmentId = enrollRes.data.enrollment_id;
    console.log('✓ Successfully enrolled with ID:', enrollmentId);

    // Verify in database
    const [[enrolledRow]] = await pool.query('SELECT * FROM program_enrollments WHERE enrollment_id = ?', [enrollmentId]);
    assert.strictEqual(enrolledRow.status, 'enrolled', 'DB status should be enrolled');
    assert.ok(enrolledRow.enrolled_at, 'DB enrolled_at should be populated');

    // 2. Test Unenroll (Status Change Only, No Hard Delete)
    console.log('2. Testing Unenroll beneficiary (Zero Data Loss)...');
    const unenrollReq = {
      user: { user_id: 1, role: 'admin', barangay: null },
      body: {
        enrollment_id: enrollmentId,
        reason: 'Transferred Residence / Barangay',
        notes: 'Family relocated to another barangay',
      },
    };
    const unenrollRes = mockRes();
    await unenrollProgramBeneficiary(unenrollReq, unenrollRes);

    assert.strictEqual(unenrollRes.statusCode, 200, 'Unenroll should succeed with 200');
    assert.strictEqual(unenrollRes.data.status, 'unenrolled', 'Response status should be unenrolled');

    // Verify record is STILL in database with unenrolled_at and unenroll_reason
    const [[unenrolledRow]] = await pool.query('SELECT * FROM program_enrollments WHERE enrollment_id = ?', [enrollmentId]);
    assert.ok(unenrolledRow, 'Enrollment record MUST still exist in database!');
    assert.strictEqual(unenrolledRow.status, 'unenrolled', 'DB status should be unenrolled');
    assert.ok(unenrolledRow.unenrolled_at, 'DB unenrolled_at must be populated');
    assert.strictEqual(unenrolledRow.unenroll_reason, 'Transferred Residence / Barangay', 'Reason must match');
    assert.strictEqual(unenrolledRow.unenroll_notes, 'Family relocated to another barangay', 'Notes must match');
    console.log('✓ Successfully unenrolled without deleting data. Timestamp and reason verified.');

    // 3. Test Hard Delete Blocking
    console.log('3. Testing Hard Delete Blocking (API Enforcement)...');
    const deleteRes = mockRes();
    await blockHardDeleteEnrollment({}, deleteRes);
    assert.strictEqual(deleteRes.statusCode, 403, 'Hard delete must return 403 Forbidden');
    assert.ok(deleteRes.data.message.includes('Hard delete forbidden'), 'Should return clear hard delete forbidden message');
    console.log('✓ Hard delete request successfully rejected with 403 Forbidden.');

    // 4. Test Re-enrollment (Cycle Increment & History Retention)
    console.log('4. Testing Re-enrollment...');
    const reEnrollReq = {
      user: { user_id: 1, role: 'admin', barangay: null },
      body: {
        child_external_id: testChildExtId,
        barangay: testBarangay,
        status: 'enrolled',
        notes: 'Re-enrolled after return to barangay',
      },
    };
    const reEnrollRes = mockRes();
    await upsertProgramEnrollment(reEnrollReq, reEnrollRes);

    assert.strictEqual(reEnrollRes.statusCode, 200, 'Re-enroll should return 200');
    assert.strictEqual(reEnrollRes.data.status, 'enrolled', 'Status should return enrolled');

    const [[reEnrolledRow]] = await pool.query('SELECT * FROM program_enrollments WHERE enrollment_id = ?', [enrollmentId]);
    assert.strictEqual(reEnrolledRow.status, 'enrolled', 'DB status should be enrolled');
    assert.strictEqual(reEnrolledRow.cycle_number, 2, 'cycle_number should be incremented to 2');
    console.log('✓ Successfully re-enrolled with cycle_number incremented.');

    // 5. Test History Timeline Retrieval
    console.log('5. Testing Enrollment History Timeline...');
    const historyReq = {
      query: { enrollment_id: enrollmentId },
    };
    const historyRes = mockRes();
    await getEnrollmentHistory(historyReq, historyRes);

    assert.strictEqual(historyRes.statusCode, 200, 'History should return 200');
    const historyList = historyRes.data;
    assert.ok(Array.isArray(historyList), 'History should be an array');
    assert.strictEqual(historyList.length, 3, `Expected 3 history items (enrolled, unenrolled, re_enrolled), got ${historyList.length}`);
    console.log('✓ History list successfully verified:');
    historyList.forEach(h => console.log(`   - [${h.action}] on ${h.action_date} | Reason: ${h.reason || 'None'}`));

    console.log('\n🎉 ALL FEEDING PROGRAM RETENTION TESTS PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    if (enrollmentId) {
      // Clean up test data safely via raw SQL connection for test isolation
      try {
        await pool.query('DELETE FROM feeding_enrollment_history WHERE enrollment_id = ?', [enrollmentId]);
        await pool.query('DELETE FROM program_enrollments WHERE enrollment_id = ?', [enrollmentId]);
      } catch (_) {}
    }
  }
}

runTests();
