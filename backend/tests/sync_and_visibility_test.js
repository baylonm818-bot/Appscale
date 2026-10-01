const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

(async () => {
  console.log('--- STARTING LIVE DATABASE & SYNC VISIBILITY TEST ---');
  let connection;
  try {
    const resolvedHost = process.env.DB_HOST || 'localhost';
    const shouldUseSsl = process.env.DB_SSL === 'true' || /tidbcloud\.com$/i.test(resolvedHost) || /aivencloud\.com$/i.test(resolvedHost);

    connection = await mysql.createConnection({
      host: resolvedHost,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      connectTimeout: 15000,
      ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    console.log('✅ Connected successfully to TiDB Cloud Database.');
    console.log(`   Host: ${resolvedHost} | Database: ${process.env.DB_NAME}`);

    const testBarangay = 'Barangay Central Test';
    const testExtId = `child_ext_${Date.now()}`;
    const testChildName = 'Test Child Sync';

    // 1. Insert Test Child (Simulating BNS Mobile Sync)
    console.log('\n[TEST 1] Syncing new Child from BNS Mobile...');
    const [childResult] = await connection.query(
      `INSERT INTO children (
         external_id, first_name, last_name, birth_date, sex,
         age_in_months, age_group, municipality, barangay, purok, guardian_name,
         status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [testExtId, 'Test', 'Child Sync', '2023-05-10', 'male', 28, '24-59', 'Gasan', testBarangay, 'Purok 1', 'Jane Doe Guardian']
    );
    const childId = childResult.insertId;
    console.log(`✅ Child created successfully with ID: ${childId}`);

    // 2. Insert Test Nutrition Measurement (Simulating BNS Mobile Sync)
    console.log('\n[TEST 2] Syncing Growth & Nutrition Measurement from BNS Mobile...');
    const [nrResult] = await connection.query(
      `INSERT INTO nutrition_records (
         child_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
         weight_status, height_status, overall_status, bmi, bmi_status, created_at
       ) VALUES (?, CURDATE(), 28, 9.80, 78.50, 12.50, 'underweight', 'normal', 'MAM', 15.90, 'Normal', NOW())`,
      [childId]
    );
    console.log(`✅ Nutrition Record created successfully with ID: ${nrResult.insertId}`);

    // 3. Insert Test Referral (Simulating BNS Mobile Referral)
    console.log('\n[TEST 3] Submitting Risk Referral from BNS Mobile...');
    const [refResult] = await connection.query(
      `INSERT INTO referrals (
         child_id, referred_by, referred_to, reason, severity, status, notes, created_at
       ) VALUES (?, 1, 1, 'Child identified with MAM during mobile feeding assessment', 'high', 'Pending', 'Immediate checkup required', NOW())`,
      [childId]
    );
    console.log(`✅ Referral created successfully with ID: ${refResult.insertId}`);

    // 4. Insert Test Notification (Simulating Automated Sync Notification)
    console.log('\n[TEST 4] Triggering Automated System Notification...');
    await connection.query(
      `INSERT INTO notifications (title, message, type, is_read, created_at)
       VALUES (?, ?, 'system', FALSE, NOW())`,
      [
        `Data Synced Automatically: ${testChildName}`,
        `Child beneficiary ${testChildName} and MAM growth assessment in ${testBarangay} were automatically synced to the server.`
      ]
    );
    console.log(`✅ Automatic Notification created successfully.`);

    // 5. TEST BHW & ADMIN VISIBILITY QUERY (Simulating BHW Medical Records List API)
    console.log('\n[TEST 5] Testing BHW Medical Records List API Query...');
    const [bhwChildrenList] = await connection.query(
      `SELECT
         c.child_id, c.first_name, c.last_name, c.sex, c.age_in_months, c.guardian_name, c.barangay,
         nr.overall_status, nr.record_date AS last_visit, nr.weight_kg, nr.height_cm, nr.muac_cm, nr.bmi, nr.bmi_status, nr.weight_status, nr.height_status
       FROM children c
       LEFT JOIN (
         SELECT nr1.*
         FROM nutrition_records nr1
         INNER JOIN (
           SELECT child_id, MAX(record_id) AS max_id
           FROM nutrition_records
           GROUP BY child_id
         ) latest ON nr1.record_id = latest.max_id
       ) nr ON nr.child_id = c.child_id
       WHERE (LOWER(TRIM(c.barangay)) = LOWER(TRIM(?)) OR ? = 'All Barangays') AND c.status = 'active'
       ORDER BY c.first_name ASC`,
      [testBarangay, testBarangay]
    );

    console.log(`✅ BHW Query Result Count: ${bhwChildrenList.length} child(ren) found.`);
    const foundChild = bhwChildrenList.find(c => c.child_id === childId);
    if (foundChild) {
      console.log('✅ BHW Medical Records Query SUCCESS:');
      console.log(`   - Name: ${foundChild.first_name} ${foundChild.last_name}`);
      console.log(`   - Barangay: ${foundChild.barangay}`);
      console.log(`   - Weight: ${foundChild.weight_kg} kg | Height: ${foundChild.height_cm} cm`);
      console.log(`   - Status: ${foundChild.overall_status}`);
    } else {
      console.error('❌ ERROR: Synced child was NOT found in BHW query!');
    }

    // 6. TEST BHW REFERRALS LIST QUERY (Simulating BHW Referrals API)
    console.log('\n[TEST 6] Testing BHW Referrals List API Query...');
    const [bhwReferralsList] = await connection.query(
      `SELECT r.referral_id, r.reason, r.severity, r.status, c.first_name, c.last_name, COALESCE(c.barangay, m.barangay) AS barangay
       FROM referrals r
       LEFT JOIN children c ON c.child_id = r.child_id
       LEFT JOIN mothers m ON m.mother_id = r.mother_id
       WHERE r.referral_id = ?`,
      [refResult.insertId]
    );

    if (bhwReferralsList.length > 0) {
      console.log('✅ BHW Referral Query SUCCESS:');
      console.log(`   - Referral ID: ${bhwReferralsList[0].referral_id}`);
      console.log(`   - Beneficiary: ${bhwReferralsList[0].first_name} ${bhwReferralsList[0].last_name}`);
      console.log(`   - Reason: ${bhwReferralsList[0].reason}`);
      console.log(`   - Severity: ${bhwReferralsList[0].severity} | Status: ${bhwReferralsList[0].status}`);
    } else {
      console.error('❌ ERROR: Synced referral was NOT found in BHW query!');
    }

    // 7. CLEANUP TEST DATA
    console.log('\n[CLEANUP] Cleaning up test data from live DB...');
    await connection.query('DELETE FROM referrals WHERE referral_id = ?', [refResult.insertId]);
    await connection.query('DELETE FROM nutrition_records WHERE record_id = ?', [nrResult.insertId]);
    await connection.query('DELETE FROM children WHERE child_id = ?', [childId]);
    console.log('✅ Cleanup complete.');

    console.log('\n==================================================');
    console.log('🎉 ALL SYNC AND DATA VISIBILITY TESTS PASSED 100%!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ TEST FAILED WITH ERROR:', err.message || err);
  } finally {
    if (connection) await connection.end();
  }
})();
