const pool = require('../config/db');
const { isDuplicateNutritionRecord } = require('../utils/mobileSyncSafety');
const { enforceScopedBarangay } = require('../utils/roleAccess');

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.pop() || '',
    middleInitial: parts.join(' ') || null,
  };
}

function normalizeNutritionStatus(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const aliases = {
    'severely_underweight': 'severely_underweight',
    'underweight': 'underweight',
    'normal': 'normal',
    'severely_stunted': 'severely_stunted',
    'stunted': 'stunted',
    'obese': 'obese',
    'overweight': 'overweight',
    'sam': 'SAM',
    'mam': 'MAM',
  };

  return aliases[normalized] ?? normalized;
}

// Helper to determine WHO/DOH nutrition status if not provided by client
function computeNutritionStatus(weightKg, heightCm, ageMonths, sex) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const age = Number(ageMonths) || 0;

  let weightStatus = 'normal';
  let heightStatus = 'normal';
  let overallStatus = 'normal';

  // Basic anthropometric heuristics based on age if weight/height present
  if (w > 0 && age > 0) {
    const expectedWeight = (age * 0.5) + 4; // approximate baseline curve
    if (w < expectedWeight * 0.7) weightStatus = 'severely_underweight';
    else if (w < expectedWeight * 0.85) weightStatus = 'underweight';
    else if (w > expectedWeight * 1.3) weightStatus = 'obese';
    else if (w > expectedWeight * 1.15) weightStatus = 'overweight';
  }

  if (h > 0 && age > 0) {
    const expectedHeight = 50 + (age * 1.2);
    if (h < expectedHeight * 0.85) heightStatus = 'severely_stunted';
    else if (h < expectedHeight * 0.92) heightStatus = 'stunted';
  }

  if (weightStatus === 'severely_underweight' || heightStatus === 'severely_stunted') {
    overallStatus = 'SAM';
  } else if (weightStatus === 'underweight' || heightStatus === 'stunted') {
    overallStatus = 'MAM';
  } else if (weightStatus === 'obese') {
    overallStatus = 'obese';
  } else if (weightStatus === 'overweight') {
    overallStatus = 'overweight';
  }

  return { weightStatus, heightStatus, overallStatus };
}

// ── CHILD SYNC (Upsert) ──
exports.upsertChild = async (req, res) => {
  const {
    external_id,
    full_name,
    first_name,
    middle_initial,
    last_name,
    birth_date,
    gender,
    sex,
    address,
    barangay,
    purok,
    guardian_name,
    guardian_contact,
    mother_external_id,
    mother_id,
    status,
    is_enrolled,
    encoded_by,
  } = req.body;

  // debug: show user making the request
  // debug logging removed

  // Enforce barangay ownership from JWT for non-admin users to prevent
  // clients writing records into other barangays.
  const scope = enforceScopedBarangay(req.user, barangay);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only work in your assigned barangay.',
      code: scope.reason,
    });
  }
  const resolvedBarangay = scope.barangay;

  const rawGender = (sex || gender || 'male').toString().trim().toLowerCase();
  const resolvedGender = (rawGender === 'f' || rawGender === 'female' || rawGender === 'girl') ? 'female' : 'male';
  const resolvedEncodedBy = encoded_by || req.user?.user_id || null;
  const childStatus = status || 'active';
  const enrolledVal = (is_enrolled === true || is_enrolled === 1 || is_enrolled === '1') ? 1 : 0;

  let firstName = first_name;
  let lastName = last_name;
  let middleInitial = middle_initial;

  if (!firstName && full_name) {
    const parts = splitName(full_name);
    firstName = parts.firstName;
    lastName = parts.lastName;
    middleInitial = parts.middleInitial;
  }

  if (!firstName || !birth_date || !resolvedBarangay) {
    return res.status(400).json({
      message: 'Child first name, birth date, and barangay are required.',
    });
  }

  // Item 36: Strictly limit child age to 0-59 months (0 to 5 years old)
  const bDate = new Date(birth_date);
  const now = new Date();
  if (isNaN(bDate.getTime())) {
    return res.status(400).json({ message: 'Invalid birth date provided.' });
  }
  let ageMonths = (now.getFullYear() - bDate.getFullYear()) * 12 + (now.getMonth() - bDate.getMonth());
  if (now.getDate() < bDate.getDate()) ageMonths--;

  if (ageMonths < 0 || ageMonths > 59) {
    return res.status(400).json({
      message: 'Child age must be between 0 and 59 months (under 5 years old).',
      code: 'invalid_child_age',
    });
  }

  try {
    let resolvedMotherId = mother_id || null;
    if (!resolvedMotherId && mother_external_id) {
      const [[motherRow]] = await pool.query(
        'SELECT mother_id FROM mothers WHERE external_id = ? LIMIT 1',
        [mother_external_id]
      );
      if (motherRow) resolvedMotherId = motherRow.mother_id;
    }

    // Check if child exists by external_id
    if (external_id) {
      const [existing] = await pool.query(
        'SELECT child_id FROM children WHERE external_id = ? LIMIT 1',
        [external_id]
      );

      if (existing.length > 0) {
        const childId = existing[0].child_id;
        await pool.query(
          `UPDATE children SET
             first_name = ?,
             middle_initial = ?,
             last_name = ?,
             birth_date = ?,
             sex = ?,
             age_in_months = TIMESTAMPDIFF(MONTH, ?, CURDATE()),
             age_group = CASE
               WHEN TIMESTAMPDIFF(MONTH, ?, CURDATE()) <= 23 THEN '0-23'
               ELSE '24-59'
             END,
             barangay = ?,
             purok = ?,
             guardian_name = ?,
             guardian_contact = ?,
             status = ?,
             mother_id = COALESCE(?, mother_id),
             encoded_by = COALESCE(?, encoded_by),
             updated_at = CURRENT_TIMESTAMP
           WHERE child_id = ?`,
          [
            firstName,
            middleInitial || null,
            lastName || '',
            birth_date,
            resolvedGender,
            birth_date,
            birth_date,
            resolvedBarangay,
            purok || address || 'Purok 1',
            guardian_name || null,
            guardian_contact || null,
            childStatus,
            resolvedMotherId,
            resolvedEncodedBy,
            childId,
          ]
        );
        return res.status(200).json({
          message: 'Child updated successfully.',
          child_id: childId,
          external_id,
        });
      }
    }

    // Insert new child
    const [result] = await pool.query(
      `INSERT INTO children (
         external_id, first_name, middle_initial, last_name, birth_date, sex,
         age_in_months, age_group, municipality, barangay, purok, guardian_name,
         guardian_contact, mother_id, status, encoded_by
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         TIMESTAMPDIFF(MONTH, ?, CURDATE()),
         CASE WHEN TIMESTAMPDIFF(MONTH, ?, CURDATE()) <= 23 THEN '0-23' ELSE '24-59' END,
         'Gasan', ?, ?, ?,
         ?, ?, ?, ?
       )`,
      [
        external_id || null,
        firstName,
        middleInitial || null,
        lastName || '',
        birth_date,
        resolvedGender,
        birth_date,
        birth_date,
        resolvedBarangay,
        purok || address || 'Purok 1',
        guardian_name || null,
        guardian_contact || null,
        resolvedMotherId,
        childStatus,
        resolvedEncodedBy,
      ]
    );

    // Automatic Notification for BHW/Admin
    try {
      const childName = `${firstName} ${lastName || ''}`.trim();
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, created_at)
         VALUES (?, ?, 'system', FALSE, NOW())`,
        [
          `Data Synced Automatically: ${childName}`,
          `Child beneficiary ${childName} in Barangay ${resolvedBarangay} was automatically synced and added to the masterlist.`,
        ]
      );
    } catch (notifErr) {
      console.error('Auto-sync child notification error (non-fatal):', notifErr && notifErr.message);
    }

    return res.status(201).json({
      message: 'Child registered and synced automatically.',
      child_id: result.insertId,
      external_id,
      synced: true,
    });
  } catch (error) {
    console.error('Sync child error:', error);
    return res.status(500).json({ message: 'Unable to sync child beneficiary.', error: error.message });
  }
};

// ── MOTHER SYNC (Upsert) ──
exports.upsertMother = async (req, res) => {
  const {
    external_id,
    full_name,
    first_name,
    middle_initial,
    last_name,
    birth_date,
    contact_number,
    address,
    purok,
    barangay,
    weight_kg,
    height_cm,
    encoded_by,
  } = req.body;

  // Enforce barangay ownership from JWT for non-admin users.
  const scope = enforceScopedBarangay(req.user, barangay);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only work in your assigned barangay.',
      code: scope.reason,
    });
  }
  const resolvedBarangay = scope.barangay;

  let firstName = first_name;
  let lastName = last_name;
  let middleInitial = middle_initial;

  if (!firstName && full_name) {
    const parts = splitName(full_name);
    firstName = parts.firstName;
    lastName = parts.lastName;
    middleInitial = parts.middleInitial;
  }

  if (!firstName || !resolvedBarangay) {
    return res.status(400).json({ message: 'Mother first name and barangay are required.' });
  }

  const resolvedEncodedBy = encoded_by || req.user?.user_id || null;
  try {
    if (external_id) {
      const [existing] = await pool.query(
        'SELECT mother_id FROM mothers WHERE external_id = ? LIMIT 1',
        [external_id]
      );

      if (existing.length > 0) {
        const motherId = existing[0].mother_id;
        await pool.query(
          `UPDATE mothers SET
             first_name = ?,
             middle_initial = ?,
             last_name = ?,
             birth_date = ?,
             contact_number = ?,
             barangay = ?,
             purok = ?,
             weight_kg = ?,
             height_cm = ?,
             encoded_by = COALESCE(?, encoded_by),
             updated_at = CURRENT_TIMESTAMP
           WHERE mother_id = ?`,
          [
            firstName,
            middleInitial || null,
            lastName || '',
            birth_date || null,
            contact_number || null,
            resolvedBarangay,
            purok || address || 'Purok 1',
            weight_kg ? Number(weight_kg) : null,
            height_cm ? Number(height_cm) : null,
            resolvedEncodedBy,
            motherId,
          ]
        );
        return res.status(200).json({
          message: 'Mother updated successfully.',
          mother_id: motherId,
          external_id,
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO mothers (
         external_id, first_name, middle_initial, last_name, birth_date,
         municipality, barangay, purok, contact_number, weight_kg, height_cm,
         status, encoded_by
       ) VALUES (
         ?, ?, ?, ?, ?,
         'Gasan', ?, ?, ?, ?, ?,
         'active', ?
       )`,
      [
        external_id || null,
        firstName,
        middleInitial || null,
        lastName || '',
        birth_date || null,
        resolvedBarangay,
        purok || address || 'Purok 1',
        contact_number || null,
        weight_kg ? Number(weight_kg) : null,
        height_cm ? Number(height_cm) : null,
        resolvedEncodedBy,
      ]
    );

    return res.status(201).json({
      message: 'Mother registered successfully.',
      mother_id: result.insertId,
      external_id,
    });
  } catch (error) {
    console.error('Sync mother error:', error);
    return res.status(500).json({ message: 'Unable to sync mother beneficiary.', error: error.message });
  }
};

// ── NUTRITION RECORD SYNC (From Mobile BNS) ──
exports.syncNutritionRecord = async (req, res) => {
  const {
    child_id,
    child_external_id,
    record_date,
    weight_kg,
    height_cm,
    muac_cm,
    weight_status,
    height_status,
    overall_status,
    recorded_by,
  } = req.body;

  try {
    // debug logging removed
    let resolvedChildId = null;
    if (child_id && /^\d+$/.test(String(child_id))) {
      resolvedChildId = Number(child_id);
    } else {
      const lookupId = child_external_id || child_id;
      if (lookupId) {
        const [[childRow]] = await pool.query(
          'SELECT child_id FROM children WHERE external_id = ? OR child_id = ? LIMIT 1',
          [lookupId, lookupId]
        );
        if (childRow) resolvedChildId = childRow.child_id;
      }
    }

    if (!resolvedChildId) {
      return res.status(400).json({ message: 'Valid child_id or child_external_id is required.' });
    }

    // Get child details for accurate status calculation
    const [[child]] = await pool.query(
      'SELECT age_in_months, sex FROM children WHERE child_id = ?',
      [resolvedChildId]
    );

    const safeWeight = Number(weight_kg) || 0;
    const safeHeight = Number(height_cm) || 0;
    const safeMuac = Number(muac_cm) || 0;

    const calculated = computeNutritionStatus(
      safeWeight,
      safeHeight,
      child?.age_in_months || 0,
      child?.sex || 'male'
    );

    const ws = normalizeNutritionStatus(weight_status) || normalizeNutritionStatus(calculated.weightStatus);
    const hs = normalizeNutritionStatus(height_status) || normalizeNutritionStatus(calculated.heightStatus);
    const os = normalizeNutritionStatus(overall_status) || normalizeNutritionStatus(calculated.overallStatus);
    const recBy = recorded_by || req.user?.user_id || null;
    const date = record_date || new Date().toISOString().slice(0, 10);

    const [existing] = await pool.query(
      'SELECT record_id, child_id, record_date FROM nutrition_records WHERE child_id = ? AND record_date = ? LIMIT 1',
      [resolvedChildId, date]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        message: 'Nutrition measurement already recorded for this child and date.',
        duplicate: true,
        record_id: existing[0].record_id,
        overall_status: os,
      });
    }

    // Module 3 Requirement: "The system will automatically identify the nutritional status (obese, normal, underweight, etc.) based on the result of beneficiaries computed BMI."
    let computedBmi = null;
    let bmiStatus = null;
    if (safeHeight > 0 && safeWeight > 0) {
      const heightInMeters = safeHeight / 100;
      computedBmi = Number((safeWeight / (heightInMeters * heightInMeters)).toFixed(2));
      if (computedBmi < 18.5) bmiStatus = 'Underweight';
      else if (computedBmi < 25.0) bmiStatus = 'Normal';
      else if (computedBmi < 30.0) bmiStatus = 'Overweight';
      else bmiStatus = 'Obese';
    }

    const [result] = await pool.query(
      `INSERT INTO nutrition_records (
         child_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
         weight_status, height_status, overall_status, recorded_by, bmi, bmi_status
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )`,
      [
        resolvedChildId,
        date,
        child?.age_in_months || 0,
        safeWeight,
        safeHeight,
        safeMuac,
        ws,
        hs,
        os,
        recBy,
        computedBmi,
        bmiStatus,
      ]
    );

    // Auto-notification for SAM/MAM children
    const normalizedOverall = String(os || '').toUpperCase();
    if (['SAM', 'MAM'].includes(normalizedOverall)) {
      try {
        const [[childRow]] = await pool.query(
          'SELECT first_name, last_name, barangay FROM children WHERE child_id = ? LIMIT 1',
          [resolvedChildId]
        );
        const childName = childRow ? `${childRow.first_name} ${childRow.last_name}` : `Child #${resolvedChildId}`;
        const statusLabel = os === 'SAM' ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)';
        await pool.query(
          `INSERT INTO notifications (title, message, type, is_read, created_at)
           VALUES (?, ?, 'alert', FALSE, NOW())`,
          [
            `${os} Alert: ${childName}`,
            `${childName} has been measured and classified as ${statusLabel}. Immediate attention is required.`,
          ]
        );
      } catch (notifErr) {
        console.error('Auto-notification error (non-fatal):', notifErr && notifErr.message);
      }
    }

    // Automatic Notification for BHW/Admin on Nutrition Sync
    try {
      const [[childRow]] = await pool.query('SELECT first_name, last_name, barangay FROM children WHERE child_id = ? LIMIT 1', [resolvedChildId]);
      const childName = childRow ? `${childRow.first_name} ${childRow.last_name}` : `Child #${resolvedChildId}`;
      const statusLabel = os ? ` (${os})` : '';
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, created_at)
         VALUES (?, ?, 'system', FALSE, NOW())`,
        [
          `Data Synced Automatically: ${childName}`,
          `New growth measurement for ${childName}${statusLabel} (Weight: ${safeWeight}kg, Height: ${safeHeight}cm) was automatically synced to the server.`,
        ]
      );
    } catch (notifErr) {
      console.error('Auto-sync nutrition notification error (non-fatal):', notifErr && notifErr.message);
    }

    return res.status(201).json({
      message: 'Nutrition measurement synced automatically.',
      record_id: result.insertId,
      overall_status: os,
      synced: true,
    });
  } catch (error) {
    console.error('Sync nutrition record error:', error);
    return res.status(500).json({ message: 'Unable to sync nutrition record.' });
  }
};

// ── GET BENEFICIARIES FOR FLUTTER APP ──
exports.getMobileChildren = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only view your assigned barangay records.',
      code: scope.reason,
    });
  }

  const barangay = scope.barangay;

  try {
    let where = '1=1';
    const params = [];

    if (barangay) {
      where += ' AND c.barangay = ?';
      params.push(barangay);
    }

    const [children] = await pool.query(
      `SELECT
         c.child_id, c.external_id, c.first_name, c.middle_initial, c.last_name,
         c.birth_date, c.sex, c.age_in_months, c.age_group, c.barangay, c.purok,
         c.guardian_name, c.guardian_contact, c.mother_id, c.status, c.is_enrolled,
         nr.weight_kg, nr.height_cm, nr.muac_cm, nr.weight_status, nr.height_status,
         nr.overall_status, nr.record_date AS last_visit
       FROM children c
       LEFT JOIN (
         SELECT nr1.*
         FROM nutrition_records nr1
         INNER JOIN (
           SELECT child_id, MAX(record_date) AS latest_date
           FROM nutrition_records
           GROUP BY child_id
         ) latest ON nr1.child_id = latest.child_id AND nr1.record_date = latest.latest_date
       ) nr ON nr.child_id = c.child_id
       WHERE ${where}
       ORDER BY c.first_name ASC`,
      params
    );

    return res.status(200).json(children);
  } catch (error) {
    console.error('Get mobile children error:', error);
    return res.status(500).json({ message: 'Server error. Unable to load children.' });
  }
};

exports.getMobileMothers = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only view your assigned barangay records.',
      code: scope.reason,
    });
  }

  const barangay = scope.barangay;

  try {
    let where = '1=1';
    const params = [];

    if (barangay) {
      where += ' AND m.barangay = ?';
      params.push(barangay);
    }

    const [mothers] = await pool.query(
      `SELECT
         m.mother_id, m.external_id, m.first_name, m.middle_initial, m.last_name,
         m.birth_date, m.barangay, m.purok, m.contact_number, m.weight_kg, m.height_cm,
         m.status
       FROM mothers m
       WHERE ${where}
       ORDER BY m.first_name ASC`,
      params
    );

    return res.status(200).json(mothers);
  } catch (error) {
    console.error('Get mobile mothers error:', error);
    return res.status(500).json({ message: 'Server error. Unable to load mothers.' });
  }
};

exports.getMobileSchedules = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only view schedules for your assigned barangay.',
      code: scope.reason,
    });
  }

  const barangay = scope.barangay;
  const role = req.user?.role || 'bns';

  try {
    let where = "status = 'pending' AND schedule_date >= CURDATE()";
    const params = [];

    if (barangay) {
      where += " AND (barangay = ? OR barangay = 'All Barangays' OR barangay IS NULL)";
      params.push(barangay);
    }

    where += " AND (target_role = ? OR target_role IS NULL OR target_role = '')";
    params.push(role);

    const [schedules] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue, barangay, facilitator, notes, target_role
       FROM schedules
       WHERE ${where}
       ORDER BY schedule_date ASC`,
      params
    );

    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Get mobile schedules error:', error);
    return res.status(500).json({ message: 'Server error. Unable to load schedules.' });
  }
};

exports.createMobileSchedule = async (req, res) => {
  const { title, schedule_type, schedule_date, schedule_time, venue, barangay, target_role, notes } = req.body;
  const scope = enforceScopedBarangay(req.user, barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only create schedules in your assigned barangay.',
      code: scope.reason,
    });
  }
  const resolvedBarangay = scope.barangay;

  if (!title || !schedule_type || !schedule_date) {
    return res.status(400).json({ message: 'Title, type, and date are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO schedules
       (title, schedule_type, schedule_date, schedule_time, venue, barangay, target_role, notes, status, facilitator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'BNS Mobile')`,
      [title, schedule_type, schedule_date, schedule_time || null, venue || null,
       resolvedBarangay || null, target_role || 'bns', notes || null]
    );

    return res.status(201).json({ 
      message: 'Schedule created successfully.',
      schedule_id: result.insertId 
    });
  } catch (error) {
    console.error('Create mobile schedule error:', error);
    return res.status(500).json({ message: 'Unable to sync schedule to server.' });
  }
};

// ── GET NUTRITION RECORDS (full history for a barangay) ──
exports.getMobileNutritionRecords = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({ message: 'Barangay scope mismatch.' });
  }
  const barangay = scope.barangay;
  try {
    let where = '1=1';
    const params = [];
    if (barangay) {
      where += ' AND c.barangay = ?';
      params.push(barangay);
    }
    const since = req.query.since;
    if (since) {
      where += ' AND nr.record_date >= ?';
      params.push(since);
    }
    const [records] = await pool.query(
      `SELECT
         nr.record_id,
         nr.child_id,
         c.external_id AS child_external_id,
         nr.record_date,
         nr.weight_kg,
         nr.height_cm,
         nr.muac_cm,
         nr.weight_status,
         nr.height_status,
         nr.overall_status,
         nr.created_at
       FROM nutrition_records nr
       INNER JOIN children c ON c.child_id = nr.child_id
       WHERE ${where}
       ORDER BY nr.record_date ASC`,
      params
    );
    return res.status(200).json(records);
  } catch (error) {
    console.error('Get mobile nutrition records error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── FULL SYNC (single request returns all barangay data) ──
exports.getMobileSync = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({ message: 'Barangay scope mismatch.' });
  }
  const barangay = scope.barangay;
  const since = req.query.since || null;

  try {
    const childParams = barangay ? [barangay] : [];
    const childWhere = barangay ? 'c.barangay = ?' : '1=1';

    const nrParams = [];
    let nrWhere = '1=1';
    if (barangay) { nrWhere += ' AND c.barangay = ?'; nrParams.push(barangay); }
    if (since) { nrWhere += ' AND nr.record_date >= ?'; nrParams.push(since); }

    const motherParams = barangay ? [barangay] : [];
    const motherWhere = barangay ? 'm.barangay = ?' : '1=1';

    const role = req.user?.role || 'bns';
    const scheduleParams = [];
    let scheduleWhere = "(status = 'pending' OR status IS NULL)";
    if (barangay) { scheduleWhere += " AND (barangay = ? OR barangay = 'All Barangays' OR barangay IS NULL)"; scheduleParams.push(barangay); }
    scheduleWhere += " AND (target_role = ? OR target_role IS NULL OR target_role = '')";
    scheduleParams.push(role);

    const refParams = barangay ? [barangay, barangay, barangay] : [];
    const refWhere = barangay ? '(c.barangay = ? OR m.barangay = ? OR ? IS NULL)' : '1=1';

    const [[children], [nutritionRecords], [mothers], [schedules], [referrals], [notifications]] = await Promise.all([
      pool.query(
        `SELECT c.child_id, c.external_id, c.first_name, c.middle_initial, c.last_name,
                c.birth_date, c.sex, c.age_in_months, c.age_group, c.barangay, c.purok,
                c.guardian_name, c.guardian_contact, c.mother_id, c.status,
                c.updated_at,
                nr.weight_kg AS last_weight, nr.height_cm AS last_height,
                nr.weight_status, nr.height_status, nr.overall_status,
                nr.record_date AS last_visit
         FROM children c
         LEFT JOIN (
           SELECT nr1.* FROM nutrition_records nr1
           INNER JOIN (SELECT child_id, MAX(record_date) AS latest_date FROM nutrition_records GROUP BY child_id) latest
           ON nr1.child_id = latest.child_id AND nr1.record_date = latest.latest_date
         ) nr ON nr.child_id = c.child_id
         WHERE ${childWhere} ORDER BY c.first_name ASC`,
        childParams
      ),
      pool.query(
        `SELECT nr.record_id, nr.child_id, c.external_id AS child_external_id,
                nr.record_date, nr.weight_kg, nr.height_cm, nr.muac_cm,
                nr.weight_status, nr.height_status, nr.overall_status,
                nr.created_at
         FROM nutrition_records nr
         INNER JOIN children c ON c.child_id = nr.child_id
         WHERE ${nrWhere} ORDER BY nr.record_date ASC`,
        nrParams
      ),
      pool.query(
        `SELECT m.mother_id, m.external_id, m.first_name, m.middle_initial, m.last_name,
                m.birth_date, m.barangay, m.purok, m.contact_number,
                m.status, m.updated_at
         FROM mothers m WHERE ${motherWhere} ORDER BY m.first_name ASC`,
        motherParams
      ),
      pool.query(
        `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue,
                barangay, facilitator, notes, target_role, status
         FROM schedules WHERE ${scheduleWhere} ORDER BY schedule_date ASC`,
        scheduleParams
      ),
      pool.query(
        `SELECT r.referral_id, r.child_id, r.mother_id, r.reason, r.referred_to,
                r.status, r.notes, r.created_at,
                c.first_name AS beneficiary_first_name, c.last_name AS beneficiary_last_name,
                c.external_id AS child_external_id,
                COALESCE(c.barangay, m.barangay) AS barangay
         FROM referrals r
         LEFT JOIN children c ON c.child_id = r.child_id
         LEFT JOIN mothers m ON m.mother_id = r.mother_id
         WHERE ${refWhere} ORDER BY r.created_at DESC LIMIT 100`,
        refParams
      ),
      pool.query(
        `SELECT notification_id, title, message, type, is_read, related_id, created_at
         FROM notifications ORDER BY created_at DESC LIMIT 50`
      ),
    ]);

    // Fetch requester's profile picture URL
    const userId = req.user?.user_id;
    let profilePicture = null;
    if (userId) {
      const [[userRow]] = await pool.query(
        'SELECT profile_picture FROM users WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (userRow?.profile_picture) {
        const base = process.env.APP_BASE_URL || 'https://appscale-1.onrender.com';
        profilePicture = userRow.profile_picture.startsWith('http')
          ? userRow.profile_picture
          : `${base}${userRow.profile_picture}`;
      }
    }

    return res.status(200).json({
      children,
      nutritionRecords,
      mothers,
      schedules,
      referrals,
      notifications,
      profilePicture,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Full mobile sync error:', error);
    return res.status(500).json({ message: 'Server error during full sync.' });
  }
};