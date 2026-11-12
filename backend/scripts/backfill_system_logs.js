/**
 * backfill_system_logs.js — Backfill BNS/BHW activities into system_logs
 */
const pool = require('../config/db');

async function backfillSystemLogs() {
  console.log('[Backfill] Checking system_logs...');
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM system_logs');
  if (Number(cnt) > 0) {
    console.log(`[Backfill] system_logs already contains ${cnt} records. Skipping initial backfill.`);
    return;
  }

  console.log('[Backfill] system_logs is empty. Populating authentic activity records from BHW & BNS...');

  // 1. BHW Medical records audit trail
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        m.modified_by AS actor_id,
        COALESCE(m.modifier_name, CONCAT(u.first_name, ' ', u.last_name), 'BHW Worker') AS actor_name,
        COALESCE(u.role, 'bhw') AS actor_role,
        COALESCE(u.barangay, c.barangay, mot.barangay, 'Antipolo') AS barangay,
        'RECORD_MEDICAL_INTERVENTION' AS action,
        m.record_type AS entity_type,
        m.record_id AS entity_id,
        JSON_OBJECT(
          'summary', m.action_details,
          'beneficiary', m.beneficiary_name,
          'beneficiary_type', m.beneficiary_type,
          'barangay', COALESCE(u.barangay, c.barangay, mot.barangay, 'Antipolo')
        ) AS details,
        m.timestamp AS created_at
      FROM medical_records_audit_trail m
      LEFT JOIN users u ON m.modified_by = u.user_id
      LEFT JOIN children c ON (m.beneficiary_type = 'child' AND m.beneficiary_id = c.child_id)
      LEFT JOIN mothers mot ON (m.beneficiary_type = 'mother' AND m.beneficiary_id = mot.mother_id)
    `);
    console.log(`[Backfill] Added ${res.affectedRows} medical audit logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in medical records:', err.message);
  }

  // 2. BHW Referrals
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        r.referred_by AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'BHW Worker') AS actor_name,
        COALESCE(u.role, 'bhw') AS actor_role,
        COALESCE(u.barangay, c.barangay, mot.barangay, 'Antipolo') AS barangay,
        'SUBMIT_REFERRAL' AS action,
        'referral' AS entity_type,
        r.referral_id AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Referred ', COALESCE(CONCAT(c.first_name, ' ', c.last_name), CONCAT(mot.first_name, ' ', mot.last_name), 'Beneficiary'), ' for ', r.reason, ' (Status: ', r.status, ', Severity: ', r.severity, ')'),
          'reason', r.reason,
          'status', r.status,
          'severity', r.severity,
          'beneficiary', COALESCE(CONCAT(c.first_name, ' ', c.last_name), CONCAT(mot.first_name, ' ', mot.last_name)),
          'barangay', COALESCE(u.barangay, c.barangay, mot.barangay, 'Antipolo')
        ) AS details,
        r.created_at AS created_at
      FROM referrals r
      LEFT JOIN users u ON r.referred_by = u.user_id
      LEFT JOIN children c ON r.child_id = c.child_id
      LEFT JOIN mothers mot ON r.mother_id = mot.mother_id
    `);
    console.log(`[Backfill] Added ${res.affectedRows} referral logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in referrals:', err.message);
  }

  // 3. BNS Nutrition assessments
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        nr.recorded_by AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'BNS Worker') AS actor_name,
        COALESCE(u.role, 'bns') AS actor_role,
        COALESCE(u.barangay, c.barangay, 'Antipolo') AS barangay,
        'RECORD_NUTRITION_ASSESSMENT' AS action,
        'nutrition_record' AS entity_type,
        nr.record_id AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Recorded nutrition measurement for ', COALESCE(CONCAT(c.first_name, ' ', c.last_name), 'child'), ': Weight ', nr.weight_kg, 'kg, Height ', nr.height_cm, 'cm, Status: ', nr.overall_status),
          'child_name', CONCAT(c.first_name, ' ', c.last_name),
          'weight_kg', nr.weight_kg,
          'height_cm', nr.height_cm,
          'overall_status', nr.overall_status,
          'barangay', COALESCE(u.barangay, c.barangay, 'Antipolo')
        ) AS details,
        COALESCE(nr.created_at, nr.record_date) AS created_at
      FROM nutrition_records nr
      LEFT JOIN users u ON nr.recorded_by = u.user_id
      LEFT JOIN children c ON nr.child_id = c.child_id
    `);
    console.log(`[Backfill] Added ${res.affectedRows} nutrition assessment logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in nutrition records:', err.message);
  }

  // 4. Schedules (Created & Audited)
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        s.created_by AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Health Worker') AS actor_name,
        COALESCE(u.role, 'bhw') AS actor_role,
        COALESCE(s.barangay, u.barangay, 'All Barangays') AS barangay,
        'CREATE_SCHEDULE' AS action,
        'schedule' AS entity_type,
        s.schedule_id AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Created activity schedule: "', s.title, '" (Type: ', s.schedule_type, ', Venue: ', COALESCE(s.venue, 'Health Center'), ')'),
          'title', s.title,
          'schedule_type', s.schedule_type,
          'venue', s.venue,
          'barangay', COALESCE(s.barangay, u.barangay, 'All Barangays')
        ) AS details,
        s.schedule_date AS created_at
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.user_id
    `);
    console.log(`[Backfill] Added ${res.affectedRows} schedule creation logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in schedules:', err.message);
  }

  // 5. Feeding Attendance (grouped sessions)
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        fa.recorded_by AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'BNS Worker') AS actor_name,
        COALESCE(u.role, 'bns') AS actor_role,
        COALESCE(fa.barangay, u.barangay, 'Antipolo') AS barangay,
        'RECORD_FEEDING_ATTENDANCE' AS action,
        'feeding_attendance' AS entity_type,
        MIN(fa.attendance_id) AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Recorded feeding attendance for ', COUNT(*), ' beneficiaries in Barangay ', COALESCE(fa.barangay, u.barangay, 'community')),
          'attendee_count', COUNT(*),
          'barangay', COALESCE(fa.barangay, u.barangay, 'Antipolo')
        ) AS details,
        fa.attendance_date AS created_at
      FROM feeding_attendance fa
      LEFT JOIN users u ON fa.recorded_by = u.user_id
      GROUP BY fa.recorded_by, fa.attendance_date, fa.barangay, u.first_name, u.last_name, u.role, u.barangay
    `);
    console.log(`[Backfill] Added ${res.affectedRows} feeding attendance session logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in feeding attendance:', err.message);
  }

  // 6. Child services (Deworming, Vitamin A, etc.)
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        CAST(cs.provided_by AS SIGNED) AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'BHW Worker') AS actor_name,
        COALESCE(u.role, 'bhw') AS actor_role,
        COALESCE(u.barangay, c.barangay, 'Antipolo') AS barangay,
        'PROVIDE_CHILD_SERVICE' AS action,
        'child_services' AS entity_type,
        cs.service_id AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Administered ', cs.service_type, COALESCE(CONCAT(' (', cs.service_name, ')'), ''), ' to ', COALESCE(CONCAT(c.first_name, ' ', c.last_name), 'child')),
          'service_type', cs.service_type,
          'service_name', cs.service_name,
          'child_name', CONCAT(c.first_name, ' ', c.last_name),
          'barangay', COALESCE(u.barangay, c.barangay, 'Antipolo')
        ) AS details,
        cs.service_date AS created_at
      FROM child_services cs
      LEFT JOIN users u ON CAST(cs.provided_by AS SIGNED) = u.user_id
      LEFT JOIN children c ON cs.child_id = c.child_id
    `);
    console.log(`[Backfill] Added ${res.affectedRows} child service logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in child services:', err.message);
  }

  // 7. Child registrations
  try {
    const [res] = await pool.query(`
      INSERT INTO system_logs (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, created_at)
      SELECT
        u.user_id AS actor_id,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'BNS Worker') AS actor_name,
        'bns' AS actor_role,
        c.barangay AS barangay,
        'REGISTER_CHILD' AS action,
        'child' AS entity_type,
        c.child_id AS entity_id,
        JSON_OBJECT(
          'summary', CONCAT('Registered child beneficiary: ', c.first_name, ' ', c.last_name, ' in Barangay ', c.barangay),
          'child_name', CONCAT(c.first_name, ' ', c.last_name),
          'barangay', c.barangay
        ) AS details,
        c.created_at AS created_at
      FROM children c
      LEFT JOIN users u ON u.user_id = (SELECT user_id FROM users WHERE barangay = c.barangay AND role = 'bns' LIMIT 1)
    `);
    console.log(`[Backfill] Added ${res.affectedRows} child registration logs.`);
  } catch (err) {
    console.warn('[Backfill] Error in children registrations:', err.message);
  }

  const [[{ finalCount }]] = await pool.query('SELECT COUNT(*) AS finalCount FROM system_logs');
  console.log(`[Backfill] Finished! Total system_logs count: ${finalCount}`);
}

module.exports = { backfillSystemLogs };

if (require.main === module) {
  backfillSystemLogs()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
