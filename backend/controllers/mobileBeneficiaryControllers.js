const pool = require('../config/db');

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.pop() || '',
    middleInitial: parts.join(' ') || null,
  };
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
    encoded_by,
  } = req.body;

  const resolvedGender = sex || gender || 'male';
  const resolvedEncodedBy = encoded_by || req.user?.user_id || null;

  let firstName = first_name;
  let lastName = last_name;
  let middleInitial = middle_initial;

  if (!firstName && full_name) {
    const parts = splitName(full_name);
    firstName = parts.firstName;
    lastName = parts.lastName;
    middleInitial = parts.middleInitial;
  }

  if (!firstName || !birth_date || !barangay) {
    return res.status(400).json({
      message: 'Child first name, birth date, and barangay are required.',
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
            barangay,
            purok || address || 'Purok 1',
            guardian_name || null,
            guardian_contact || null,
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
         ?, ?, 'active', ?
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
        barangay,
        purok || address || 'Purok 1',
        guardian_name || null,
        guardian_contact || null,
        resolvedMotherId,
        resolvedEncodedBy,
      ]
    );

    return res.status(201).json({
      message: 'Child registered successfully.',
      child_id: result.insertId,
      external_id,
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

  let firstName = first_name;
  let lastName = last_name;
  let middleInitial = middle_initial;

  if (!firstName && full_name) {
    const parts = splitName(full_name);
    firstName = parts.firstName;
    lastName = parts.lastName;
    middleInitial = parts.middleInitial;
  }

  if (!firstName || !barangay) {
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
            barangay,
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
        barangay,
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
    let resolvedChildId = child_id;
    if (!resolvedChildId && child_external_id) {
      const [[childRow]] = await pool.query(
        'SELECT child_id, age_in_months, sex FROM children WHERE external_id = ? LIMIT 1',
        [child_external_id]
      );
      if (childRow) resolvedChildId = childRow.child_id;
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

    const ws = weight_status || calculated.weightStatus;
    const hs = height_status || calculated.heightStatus;
    const os = overall_status || calculated.overallStatus;
    const recBy = recorded_by || req.user?.user_id || null;
    const date = record_date || new Date().toISOString().slice(0, 10);

    const [result] = await pool.query(
      `INSERT INTO nutrition_records (
         child_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
         weight_status, height_status, overall_status, recorded_by
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?
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
      ]
    );

    // Auto-notification for SAM/MAM children
    if (['SAM', 'MAM'].includes(os)) {
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

    return res.status(201).json({
      message: 'Nutrition measurement synced successfully.',
      record_id: result.insertId,
      overall_status: os,
    });
  } catch (error) {
    console.error('Sync nutrition record error:', error);
    return res.status(500).json({ message: 'Unable to sync nutrition record.' });
  }
};

// ── GET BENEFICIARIES FOR FLUTTER APP ──
exports.getMobileChildren = async (req, res) => {
  const barangay = req.query.barangay || req.user?.barangay;

  try {
    let where = "c.status = 'active'";
    const params = [];

    if (barangay) {
      where += ' AND c.barangay = ?';
      params.push(barangay);
    }

    const [children] = await pool.query(
      `SELECT
         c.child_id, c.external_id, c.first_name, c.middle_initial, c.last_name,
         c.birth_date, c.sex, c.age_in_months, c.age_group, c.barangay, c.purok,
         c.guardian_name, c.guardian_contact, c.mother_id, c.status,
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
  const barangay = req.query.barangay || req.user?.barangay;

  try {
    let where = "m.status = 'active'";
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
  const barangay = req.query.barangay || req.user?.barangay;
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