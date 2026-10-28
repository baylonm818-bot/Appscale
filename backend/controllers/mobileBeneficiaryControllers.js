const pool = require('../config/db');
const { isDuplicateNutritionRecord } = require('../utils/mobileSyncSafety');
const { enforceScopedBarangay } = require('../utils/roleAccess');
const { validateMeasurementPlausibility } = require('../utils/growthRangeValidator');
const { validateContactNumber } = require('../utils/contactValidation');

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
    'severly_underweight': 'severely_underweight',
    'underweight': 'underweight',
    'normal': 'normal',
    'severely_stunted': 'severely_stunted',
    'severly_stunted': 'severely_stunted',
    'stunted': 'stunted',
    'tall': 'normal',
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

  if (guardian_contact !== undefined && guardian_contact !== null && String(guardian_contact).trim() !== '') {
    const contactCheck = validateContactNumber(guardian_contact);
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
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

        if (req.body.is_enrolled != null) {
          try {
            const isEnrolled = Boolean(req.body.is_enrolled);
            const cExtId = external_id || String(childId);
            const cName = `${firstName} ${lastName || ''}`.trim();
            const [existingEnr] = await pool.query(
              'SELECT enrollment_id, status FROM program_enrollments WHERE child_id = ? AND program_type = "feeding" LIMIT 1',
              [childId]
            );
            if (existingEnr.length > 0) {
              const currentStatus = existingEnr[0].status;
              const newStatus = isEnrolled ? 'enrolled' : 'unenrolled';
              if (currentStatus !== newStatus) {
                if (!isEnrolled) {
                  await pool.query(
                    `UPDATE program_enrollments
                     SET status = 'unenrolled', unenrolled_at = NOW(), unenrolled_by = ?, unenroll_reason = ?, updated_at = NOW()
                     WHERE enrollment_id = ?`,
                    [resolvedEncodedBy, req.body.unenroll_reason || 'Child profile sync unenrollment', existingEnr[0].enrollment_id]
                  );
                  await pool.query(
                    `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason)
                     VALUES (?, ?, ?, ?, 'unenrolled', NOW(), ?, ?)`,
                    [existingEnr[0].enrollment_id, childId, cExtId, resolvedBarangay, resolvedEncodedBy, req.body.unenroll_reason || 'Child profile sync unenrollment']
                  );
                } else {
                  await pool.query(
                    `UPDATE program_enrollments
                     SET status = 'enrolled', enrolled_at = NOW(), enrolled_by = ?, unenrolled_at = NULL, unenrolled_by = NULL, unenroll_reason = NULL, cycle_number = cycle_number + 1, updated_at = NOW()
                     WHERE enrollment_id = ?`,
                    [resolvedEncodedBy, existingEnr[0].enrollment_id]
                  );
                  await pool.query(
                    `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason)
                     VALUES (?, ?, ?, ?, 're_enrolled', NOW(), ?, 'Re-enrolled via child sync')`,
                    [existingEnr[0].enrollment_id, childId, cExtId, resolvedBarangay, resolvedEncodedBy]
                  );
                }
              }
            } else if (isEnrolled) {
              const [insResult] = await pool.query(
                `INSERT INTO program_enrollments (external_id, program_type, beneficiary_type, child_id, child_external_id, beneficiary_name, barangay, enrolled_at, status, enrolled_by)
                 VALUES (?, 'feeding', 'child', ?, ?, ?, ?, NOW(), 'enrolled', ?)`,
                [`${resolvedBarangay}|feeding|${cExtId}`, childId, cExtId, cName, resolvedBarangay, resolvedEncodedBy]
              );
              await pool.query(
                `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason)
                 VALUES (?, ?, ?, ?, 'enrolled', NOW(), ?, 'Initial enrollment')`,
                [insResult.insertId, childId, cExtId, resolvedBarangay, resolvedEncodedBy]
              );
            }
          } catch (enrErr) {
            console.error('Child is_enrolled update error:', enrErr.message);
          }
        }

        return res.status(200).json({
          message: 'Child updated successfully.',
          child_id: childId,
          server_id: childId,
          external_id,
          mother_id: resolvedMotherId,
          synced: true,
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
        `INSERT INTO notifications (title, message, type, is_read, recipient_role, barangay, created_at)
         VALUES (?, ?, 'child', FALSE, 'admin', ?, NOW())`,
        [
          `New Child Registered: ${childName}`,
          `Child beneficiary ${childName} in Barangay ${resolvedBarangay} was added to the masterlist.`,
          resolvedBarangay,
        ]
      );
    } catch (notifErr) {
      console.error('Auto-sync child notification error (non-fatal):', notifErr && notifErr.message);
    }

    if (req.body.is_enrolled != null && Boolean(req.body.is_enrolled)) {
      try {
        const childId = result.insertId;
        const cExtId = external_id || String(childId);
        const cName = `${firstName} ${lastName || ''}`.trim();
        const [insResult] = await pool.query(
          `INSERT INTO program_enrollments (external_id, program_type, beneficiary_type, child_id, child_external_id, beneficiary_name, barangay, enrolled_at, status, enrolled_by)
           VALUES (?, 'feeding', 'child', ?, ?, ?, ?, NOW(), 'enrolled', ?)`,
          [`${resolvedBarangay}|feeding|${cExtId}`, childId, cExtId, cName, resolvedBarangay, resolvedEncodedBy]
        );
        await pool.query(
          `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason)
           VALUES (?, ?, ?, ?, 'enrolled', NOW(), ?, 'Initial enrollment upon registration')`,
          [insResult.insertId, childId, cExtId, resolvedBarangay, resolvedEncodedBy]
        );
      } catch (enrErr) {
        console.error('Child is_enrolled insert error:', enrErr.message);
      }
    }

    return res.status(201).json({
      message: 'Child registered and synced automatically.',
      child_id: result.insertId,
      server_id: result.insertId,
      external_id,
      mother_id: resolvedMotherId,
      synced: true,
    });
  } catch (error) {
    console.error('Sync child SQL error:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      payload: req.body,
      message: error.message,
    });
    const sqlMsg = error.sqlMessage || error.message || 'Unknown database error';
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ message: `Duplicate child record: ${sqlMsg}`, code: error.code, duplicate: true });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW' || error.errno === 1452) {
      return res.status(400).json({ message: `Referenced mother_id not found: ${sqlMsg}`, code: error.code });
    }
    if (error.code === 'ER_BAD_NULL_ERROR' || error.errno === 1048) {
      return res.status(400).json({ message: `Required field missing: ${sqlMsg}`, code: error.code });
    }
    return res.status(500).json({ message: `Unable to sync child beneficiary: ${sqlMsg}`, code: error.code || 'SERVER_ERROR' });
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

  if (contact_number !== undefined && contact_number !== null && String(contact_number).trim() !== '') {
    const contactCheck = validateContactNumber(contact_number);
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
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
            req.body.muac_cm ? Number(req.body.muac_cm) : null,
            null,
            null,
            null,
            resolvedEncodedBy,
            motherId,
          ]
        );
        // compute bmi and muac status and update
        try {
          const safeWeight = req.body.weight_kg ? Number(req.body.weight_kg) : null;
          const safeHeight = req.body.height_cm ? Number(req.body.height_cm) : null;
          const safeMuac = req.body.muac_cm ? Number(req.body.muac_cm) : null;
          let bmi = null;
          let bmiStatus = null;
          let muacStatus = null;
          if (safeWeight && safeHeight && safeHeight > 0) {
            bmi = Number((safeWeight / Math.pow(safeHeight / 100, 2)).toFixed(2));
            if (bmi < 18.5) bmiStatus = 'Underweight';
            else if (bmi < 25) bmiStatus = 'Normal';
            else if (bmi < 30) bmiStatus = 'Overweight';
            else bmiStatus = 'Obese';
          }
          if (safeMuac != null) {
            muacStatus = safeMuac < 23 ? 'At risk' : 'Normal';
          }
          await pool.query(
            'UPDATE mothers SET bmi = ?, bmi_status = ?, muac_cm = ?, muac_status = ? WHERE mother_id = ?',
            [bmi, bmiStatus, safeMuac, muacStatus, motherId]
          );
        } catch (e) {
          console.error('Post-update mother BMI computation failed:', e && e.message);
        }
        if (Array.isArray(req.body.linked_child_external_ids) && req.body.linked_child_external_ids.length > 0) {
          try {
            await pool.query(
              'UPDATE children SET mother_id = ? WHERE external_id IN (?)',
              [motherId, req.body.linked_child_external_ids]
            );
          } catch (linkErr) {
            console.error('Link children to mother error (update):', linkErr && linkErr.message);
          }
        }
        return res.status(200).json({
          message: 'Mother updated successfully.',
          mother_id: motherId,
          server_id: motherId,
          external_id,
          synced: true,
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO mothers (
         external_id, first_name, middle_initial, last_name, birth_date,
         municipality, barangay, purok, contact_number, weight_kg, height_cm,
         muac_cm, bmi, bmi_status, muac_status, status, encoded_by
       ) VALUES (
         ?, ?, ?, ?, ?,
         'Gasan', ?, ?, ?, ?, ?,
         ?, ?, ?, ?, 'active', ?
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
        req.body.muac_cm ? Number(req.body.muac_cm) : null,
        null,
        null,
        null,
        resolvedEncodedBy,
      ]
    );

    // compute bmi and muac status for new mother and persist
    try {
      const motherId = result.insertId;
      const safeWeight = req.body.weight_kg ? Number(req.body.weight_kg) : null;
      const safeHeight = req.body.height_cm ? Number(req.body.height_cm) : null;
      const safeMuac = req.body.muac_cm ? Number(req.body.muac_cm) : null;
      let bmi = null;
      let bmiStatus = null;
      let muacStatus = null;
      if (safeWeight && safeHeight && safeHeight > 0) {
        bmi = Number((safeWeight / Math.pow(safeHeight / 100, 2)).toFixed(2));
        if (bmi < 18.5) bmiStatus = 'Underweight';
        else if (bmi < 25) bmiStatus = 'Normal';
        else if (bmi < 30) bmiStatus = 'Overweight';
        else bmiStatus = 'Obese';
      }
      if (safeMuac != null) {
        muacStatus = safeMuac < 23 ? 'At risk' : 'Normal';
      }
    } catch (e) {
      console.error('Post-insert mother BMI computation failed:', e && e.message);
    }

    // Automatic Notification for BHW/Admin on new mother registration
    try {
      const motherName = `${firstName} ${lastName || ''}`.trim();
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, recipient_role, barangay, created_at)
         VALUES (?, ?, 'mother', FALSE, 'bhw', ?, NOW())`,
        [
          `New Mother Registered: ${motherName}`,
          `Mother beneficiary ${motherName} in Barangay ${resolvedBarangay} was added to the masterlist.`,
          resolvedBarangay,
        ]
      );
    } catch (notifErr) {
      console.error('Auto-sync mother notification error (non-fatal):', notifErr && notifErr.message);
    }

    if (Array.isArray(req.body.linked_child_external_ids) && req.body.linked_child_external_ids.length > 0) {
      try {
        await pool.query(
          'UPDATE children SET mother_id = ? WHERE external_id IN (?)',
          [result.insertId, req.body.linked_child_external_ids]
        );
      } catch (linkErr) {
        console.error('Link children to mother error (insert):', linkErr && linkErr.message);
      }
    }

    return res.status(201).json({
      message: 'Mother registered successfully.',
      mother_id: result.insertId,
      server_id: result.insertId,
      external_id,
      synced: true,
    });
  } catch (error) {
    console.error('Sync mother SQL error:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      payload: req.body,
      message: error.message,
    });
    const sqlMsg = error.sqlMessage || error.message || 'Unknown database error';
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ message: `Duplicate mother record: ${sqlMsg}`, code: error.code, duplicate: true });
    }
    if (error.code === 'ER_BAD_NULL_ERROR' || error.errno === 1048) {
      return res.status(400).json({ message: `Required field missing: ${sqlMsg}`, code: error.code });
    }
    return res.status(500).json({ message: `Unable to sync mother beneficiary: ${sqlMsg}`, code: error.code || 'SERVER_ERROR' });
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

    if (record_date) {
      const recDate = new Date(record_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (recDate > today) {
        return res.status(400).json({ message: 'Measurement record date cannot be in the future.' });
      }
    }

    // Get child details for accurate status calculation
    const [[child]] = await pool.query(
      'SELECT age_in_months, sex FROM children WHERE child_id = ?',
      [resolvedChildId]
    );

    const safeWeight = Number(weight_kg) || 0;
    const safeHeight = Number(height_cm) || 0;
    const safeMuac = muac_cm != null && Number(muac_cm) > 0 ? Number(muac_cm) : null;

    const plausibility = validateMeasurementPlausibility(
      safeWeight,
      safeHeight,
      child?.age_in_months || 0
    );
    const isPlausible = plausibility.isValid;

    let computedBmi = null;
    let bmiStatus = null;
    let ws = null;
    let hs = null;
    let os = null;

    if (isPlausible) {
      const calculated = computeNutritionStatus(
        safeWeight,
        safeHeight,
        child?.age_in_months || 0,
        child?.sex || 'male'
      );
      ws = normalizeNutritionStatus(weight_status) || normalizeNutritionStatus(calculated.weightStatus);
      hs = normalizeNutritionStatus(height_status) || normalizeNutritionStatus(calculated.heightStatus);
      os = normalizeNutritionStatus(overall_status) || normalizeNutritionStatus(calculated.overallStatus);

      if (safeHeight > 0 && safeWeight > 0) {
        const heightInMeters = safeHeight / 100;
        computedBmi = Number((safeWeight / (heightInMeters * heightInMeters)).toFixed(2));
        if (computedBmi < 18.5) bmiStatus = 'Underweight';
        else if (computedBmi < 25.0) bmiStatus = 'Normal';
        else if (computedBmi < 30.0) bmiStatus = 'Overweight';
        else bmiStatus = 'Obese';
      }
    } else {
      ws = 'Needs re-measurement';
      hs = 'Needs re-measurement';
      os = 'Needs re-measurement';
      computedBmi = null;
      bmiStatus = 'Needs re-measurement';
    }

    const recBy = recorded_by || req.user?.user_id || null;
    const date = record_date || new Date().toISOString().slice(0, 10);

    const [existing] = await pool.query(
      'SELECT record_id, child_id, record_date FROM nutrition_records WHERE child_id = ? AND (record_date = ? OR DATE(record_date) = ?) LIMIT 1',
      [resolvedChildId, date, String(date).slice(0, 10)]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        message: 'Nutrition measurement already recorded for this child and date.',
        duplicate: true,
        record_id: existing[0].record_id,
        overall_status: os,
        isPlausible,
      });
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

    // Auto-notification for SAM/MAM children (ONLY for valid/plausible records)
    const normalizedOverall = String(os || '').toUpperCase();
    if (isPlausible && ['SAM', 'MAM'].includes(normalizedOverall)) {
      try {
        const [[childRow]] = await pool.query(
          'SELECT first_name, last_name, barangay FROM children WHERE child_id = ? LIMIT 1',
          [resolvedChildId]
        );
        const childName = childRow ? `${childRow.first_name} ${childRow.last_name}` : `Child #${resolvedChildId}`;
        const statusLabel = os === 'SAM' ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)';
        await pool.query(
          `INSERT INTO notifications (title, message, type, is_read, recipient_role, barangay, created_at)
           VALUES (?, ?, 'alert', FALSE, 'bhw', ?, NOW())`,
          [
            `${os} Alert: ${childName}`,
            `${childName} has been measured and classified as ${statusLabel}. Immediate attention is required.`,
            childRow ? childRow.barangay : null,
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
    console.error('Sync nutrition record SQL error:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      payload: req.body,
      message: error.message,
    });
    const sqlMsg = error.sqlMessage || error.message || 'Unknown database error';
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ message: `Duplicate nutrition record: ${sqlMsg}`, code: error.code, duplicate: true });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW' || error.errno === 1452) {
      return res.status(400).json({ message: `Referenced child_id not found: ${sqlMsg}`, code: error.code });
    }
    return res.status(500).json({ message: `Unable to sync nutrition record: ${sqlMsg}`, code: error.code || 'SERVER_ERROR' });
  }
};

// ── UPDATE NUTRITION RECORD ──
exports.updateNutritionRecord = async (req, res) => {
  const {
    record_id,
    child_id,
    child_external_id,
    record_date,
    weight_kg,
    height_cm,
    muac_cm,
    weight_status,
    height_status,
    overall_status,
    audit_note,
  } = req.body;

  let conn;
  try {
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

    if (!resolvedChildId || !record_date) {
      return res.status(400).json({ message: 'Child ID and record date are required.' });
    }

    // Lookup child details for age and sex
    const [[child]] = await pool.query(
      'SELECT age_in_months, sex, birth_date FROM children WHERE child_id = ? LIMIT 1',
      [resolvedChildId]
    );

    // Calculate age in completed months at measurement date if birth_date is available
    let ageMonths = child?.age_in_months || 0;
    if (child?.birth_date && record_date) {
      const bDate = new Date(child.birth_date);
      const mDate = new Date(record_date);
      let months = (mDate.getFullYear() - bDate.getFullYear()) * 12 + (mDate.getMonth() - bDate.getMonth());
      if (mDate.getDate() < bDate.getDate()) {
        months -= 1;
      }
      ageMonths = Math.max(0, months);
    }

    const safeWeight = Number(weight_kg) || 0;
    const safeHeight = Number(height_cm) || 0;
    const safeMuac = muac_cm != null && Number(muac_cm) > 0 ? Number(muac_cm) : null;

    const plausibility = validateMeasurementPlausibility(safeWeight, safeHeight, ageMonths);
    const isPlausible = plausibility.isValid;

    let computedBmi = null;
    let bmiStatus = null;
    let ws = null;
    let hs = null;
    let os = null;

    if (isPlausible) {
      if (safeHeight > 0 && safeWeight > 0) {
        const heightInMeters = safeHeight / 100;
        computedBmi = Number((safeWeight / (heightInMeters * heightInMeters)).toFixed(2));
        if (computedBmi < 18.5) bmiStatus = 'Underweight';
        else if (computedBmi < 25.0) bmiStatus = 'Normal';
        else if (computedBmi < 30.0) bmiStatus = 'Overweight';
        else bmiStatus = 'Obese';
      }
      ws = normalizeNutritionStatus(weight_status);
      hs = normalizeNutritionStatus(height_status);
      os = normalizeNutritionStatus(overall_status);
    } else {
      // Implausible measurement: do not compute BMI or nutrition status
      ws = 'Needs re-measurement';
      hs = 'Needs re-measurement';
      os = 'Needs re-measurement';
      computedBmi = null;
      bmiStatus = 'Needs re-measurement';
    }

    const updatedBy = req.user?.user_id || req.body.recorded_by || null;
    const note = audit_note || `Updated by user #${updatedBy || 'BNS'} on ${new Date().toISOString()}`;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    let updateResult;
    const dateOnly = String(record_date).slice(0, 10);

    if (record_id) {
      [updateResult] = await conn.query(
        `UPDATE nutrition_records
         SET weight_kg = ?, height_cm = ?, muac_cm = ?,
             weight_status = ?, height_status = ?, overall_status = ?,
             bmi = ?, bmi_status = ?, remarks = CONCAT(COALESCE(remarks, ''), ' [', ?, ']')
         WHERE record_id = ?`,
        [
          safeWeight,
          safeHeight,
          safeMuac,
          ws,
          hs,
          os,
          computedBmi,
          bmiStatus,
          note,
          record_id,
        ]
      );
    } else {
      [updateResult] = await conn.query(
        `UPDATE nutrition_records
         SET weight_kg = ?, height_cm = ?, muac_cm = ?,
             weight_status = ?, height_status = ?, overall_status = ?,
             bmi = ?, bmi_status = ?, remarks = CONCAT(COALESCE(remarks, ''), ' [', ?, ']')
         WHERE child_id = ? AND (record_date = ? OR DATE(record_date) = ?)`,
        [
          safeWeight,
          safeHeight,
          safeMuac,
          ws,
          hs,
          os,
          computedBmi,
          bmiStatus,
          note,
          resolvedChildId,
          record_date,
          dateOnly,
        ]
      );
    }

    await conn.commit();

    return res.status(200).json({
      message: 'Nutrition record updated successfully.',
      affectedRows: updateResult.affectedRows,
      synced: true,
      isPlausible,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Update nutrition record error:', error);
    const sqlMsg = error.sqlMessage || error.message || 'Unknown database error';
    return res.status(500).json({
      message: `Failed to update nutrition record: ${sqlMsg}`,
      code: error.code || 'SERVER_ERROR',
    });
  } finally {
    if (conn) conn.release();
  }
};

// ── DELETE NUTRITION RECORD ──
exports.deleteNutritionRecord = async (req, res) => {
  const { child_id, child_external_id, record_date } = req.body;

  try {
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

    if (!resolvedChildId || !record_date) {
      return res.status(400).json({ message: 'Child ID and record date are required.' });
    }

    const [deleteResult] = await pool.query(
      'DELETE FROM nutrition_records WHERE child_id = ? AND record_date = ?',
      [resolvedChildId, record_date]
    );

    return res.status(200).json({
      message: 'Nutrition record deleted successfully.',
      affectedRows: deleteResult.affectedRows,
      synced: true,
    });
  } catch (error) {
    console.error('Delete nutrition record error:', error);
    return res.status(500).json({ message: 'Server error deleting nutrition record.' });
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
         SELECT nr_sub.* FROM (
           SELECT nr1.*,
                  ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
           FROM nutrition_records nr1
         ) nr_sub WHERE nr_sub.rn = 1
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
         m.muac_cm, m.bmi, m.bmi_status, m.muac_status, m.status
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
  const role = (req.user?.role || 'bns').toLowerCase();

  try {
    let where = "(status = 'pending' OR status IS NULL) AND (schedule_date >= CURDATE() OR schedule_date IS NULL)";
    const params = [];

    if (barangay) {
      where += " AND (barangay = ? OR barangay = 'All Barangays' OR barangay = 'All' OR barangay IS NULL)";
      params.push(barangay);
    }

    where += " AND (target_role = ? OR target_role = 'all' OR target_role = 'All' OR target_role = 'All Beneficiaries' OR target_role IS NULL OR target_role = '')";
    params.push(role);

    const [schedules] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue, barangay, facilitator, notes, target_role, status
       FROM schedules
       WHERE ${where}
       ORDER BY schedule_date ASC`,
      params
    );

    // Attach schedule_targets and enforce server-side visibility
    const schedulesArr = Array.isArray(schedules) ? schedules : [];
    const schedIds = schedulesArr.map((s) => s.schedule_id).filter(Boolean);
    let visible = [];
    if (schedIds.length > 0) {
      const placeholders = schedIds.map(() => '?').join(',');
      const [targetsRows] = await pool.query(
        `SELECT schedule_id, target_type, target_value FROM schedule_targets WHERE schedule_id IN (${placeholders})`,
        schedIds
      );
      const targetsById = {};
      for (const t of targetsRows) {
        targetsById[t.schedule_id] = targetsById[t.schedule_id] || [];
        targetsById[t.schedule_id].push({ type: t.target_type, value: t.target_value });
      }

      for (const s of schedulesArr) {
        const targets = targetsById[s.schedule_id] || [];
        s.targets = targets;
        if (targets.length === 0) {
          // No granular targets specified: SQL query already validated barangay and target_role
          visible.push(s);
        } else {
          const isGlobal = targets.some((t) => t.type === 'global' || t.value === 'all' || t.value === 'All Barangays');
          const barangayMatch = targets.some((t) => t.type === 'barangay' && t.value && (String(t.value).toLowerCase() === String(barangay || '').toLowerCase() || String(t.value).toLowerCase() === 'all' || String(t.value).toLowerCase() === 'all barangays'));
          const userMatch = targets.some((t) => t.type === 'user' && t.value && String(t.value) === String(req.user?.user_id));
          if (isGlobal || barangayMatch || userMatch) {
            visible.push(s);
          }
        }
      }
    } else {
      visible = schedulesArr;
    }

    return res.status(200).json(visible);
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
       resolvedBarangay || null, target_role || 'bhw', notes || null]
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

    const role = (req.user?.role || 'bns').toLowerCase();
    const scheduleParams = [];
    let scheduleWhere = "(status = 'pending' OR status IS NULL) AND (schedule_date >= CURDATE() OR schedule_date IS NULL)";
    if (barangay) { scheduleWhere += " AND (barangay = ? OR barangay = 'All Barangays' OR barangay = 'All' OR barangay IS NULL)"; scheduleParams.push(barangay); }
    scheduleWhere += " AND (target_role = ? OR target_role = 'all' OR target_role = 'All' OR target_role = 'All Beneficiaries' OR target_role IS NULL OR target_role = '')";
    scheduleParams.push(role);

    const refParams = barangay ? [barangay, barangay, barangay] : [];
    const refWhere = barangay ? '(c.barangay = ? OR m.barangay = ? OR ? IS NULL)' : '1=1';

    const [[children], [nutritionRecords], [mothers], [motherServices], [schedules], [referrals], [notifications], [programEnrollments], [mealPlans], [feedingAttendance], [feedingSchedule], [childServices]] = await Promise.all([
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
           SELECT nr_sub.* FROM (
             SELECT nr1.*,
                    ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
             FROM nutrition_records nr1
           ) nr_sub WHERE nr_sub.rn = 1
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
          m.weight_kg, m.height_cm, m.muac_cm, m.bmi, m.bmi_status, m.muac_status,
          m.status, m.updated_at
         FROM mothers m WHERE ${motherWhere} ORDER BY m.first_name ASC`,
        motherParams
      ),
      pool.query(
        `SELECT ms.service_id, ms.external_id, ms.mother_id, m.external_id AS mother_external_id,
                ms.service_type, ms.service_name, ms.dosage, ms.service_date, ms.provided_by, ms.notes
         FROM mother_services ms
         INNER JOIN mothers m ON m.mother_id = ms.mother_id
         WHERE ${motherWhere} ORDER BY ms.service_date ASC`,
        motherParams
      ),
      pool.query(
        `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue,
                barangay, facilitator, notes, target_role, status
         FROM schedules WHERE ${scheduleWhere} ORDER BY schedule_date ASC`,
        scheduleParams
      ),
      pool.query(
        `SELECT r.referral_id, r.child_id, r.mother_id, r.external_id,
                COALESCE(r.referral_type, CASE WHEN r.mother_id IS NOT NULL THEN 'mother' ELSE 'child' END) AS referral_type,
                r.reason, r.referred_to,
                r.status, r.notes, r.created_at, r.updated_at,
                r.archived_at, r.archived_by,
                COALESCE(c.first_name, m.first_name) AS beneficiary_first_name,
                COALESCE(c.last_name, m.last_name) AS beneficiary_last_name,
                COALESCE(c.external_id, m.external_id) AS beneficiary_external_id,
                c.external_id AS child_external_id,
                m.external_id AS mother_external_id,
                CASE WHEN r.mother_id IS NOT NULL THEN 'mother' ELSE 'child' END AS beneficiary_type,
                COALESCE(c.barangay, m.barangay) AS barangay
         FROM referrals r
         LEFT JOIN children c ON c.child_id = r.child_id
         LEFT JOIN mothers m ON m.mother_id = r.mother_id
         WHERE ${refWhere} ORDER BY r.created_at DESC LIMIT 100`,
        refParams
      ),
      pool.query(
        `SELECT DISTINCT n.notification_id, n.title, n.message, n.type, n.is_read, n.related_id, n.created_at
         FROM notifications n
         LEFT JOIN schedules s ON n.type = 'schedule' AND n.related_id = s.schedule_id
         LEFT JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
         LEFT JOIN children c ON c.child_id = r.child_id
         LEFT JOIN mothers m ON m.mother_id = r.mother_id
         WHERE ? IS NULL OR TRIM(?) = ''
            OR s.barangay = ? OR s.barangay = 'All Barangays'
            OR COALESCE(c.barangay, m.barangay) = ?
            OR n.title LIKE ? OR n.message LIKE ?
         ORDER BY n.created_at DESC LIMIT 50`,
        [barangay, barangay, barangay, barangay, `%${barangay}%`, `%${barangay}%`]
      ),
      pool.query(
        `SELECT pe.enrollment_id, pe.external_id, pe.program_type, pe.beneficiary_type,
                pe.child_id, pe.mother_id, pe.child_external_id, pe.mother_external_id,
                pe.beneficiary_name, pe.barangay, pe.enrolled_at, pe.status, pe.notes,
                pe.unenrolled_at, pe.unenrolled_by, pe.unenroll_reason, pe.cycle_number
         FROM program_enrollments pe
         WHERE ${barangay ? 'pe.barangay = ?' : '1=1'}
         ORDER BY pe.enrolled_at DESC`,
        barangay ? [barangay] : []
      ),
      pool.query(
        `SELECT mp.plan_id, mp.external_id, mp.barangay, mp.week_number, mp.day_of_week,
                mp.meal_name, mp.ingredients, mp.notes, mp.target_group, mp.created_at, mp.updated_at
         FROM meal_plans mp
         WHERE ${barangay ? 'mp.barangay = ?' : '1=1'}
         ORDER BY mp.created_at DESC`,
        barangay ? [barangay] : []
      ),
      pool.query(
        `SELECT fa.attendance_id, fa.external_id, fa.child_id, fa.child_external_id,
                fa.barangay, fa.attendance_date, fa.status, fa.meal_served, fa.remarks
         FROM feeding_attendance fa
         WHERE ${barangay ? 'fa.barangay = ?' : '1=1'}
         ORDER BY fa.attendance_date DESC`,
        barangay ? [barangay] : []
      ),
      pool.query(
        `SELECT fs.schedule_id, fs.barangay, fs.feeding_time, fs.start_time, fs.end_time,
                fs.venue, fs.days_of_week, fs.target_count, fs.notes
         FROM feeding_schedules fs
         WHERE ${barangay ? 'fs.barangay = ?' : '1=1'}
         LIMIT 1`,
        barangay ? [barangay] : []
      ),
      pool.query(
        `SELECT cs.service_id, cs.external_id, cs.child_id, c.external_id AS child_external_id,
                cs.service_type, cs.service_name, cs.dosage, cs.service_date, cs.provided_by, cs.notes
         FROM child_services cs
         INNER JOIN children c ON c.child_id = cs.child_id
         WHERE ${barangay ? 'c.barangay = ?' : '1=1'}
         ORDER BY cs.service_date ASC`,
        barangay ? [barangay] : []
      ),
    ]);

    // Attach items_given for referrals
    const refIds = (referrals || []).map((r) => r.referral_id).filter(Boolean);
    if (refIds.length > 0) {
      try {
        const [itemsRows] = await pool.query(
          `SELECT referral_id, item_name, quantity, unit, given_at
           FROM referral_items
           WHERE referral_id IN (${refIds.map(() => '?').join(',')})`,
          refIds
        );
        const itemsMap = {};
        for (const item of itemsRows) {
          itemsMap[item.referral_id] = itemsMap[item.referral_id] || [];
          itemsMap[item.referral_id].push(item);
        }
        for (const r of referrals) {
          r.items_given = itemsMap[r.referral_id] || [];
        }
      } catch (_) {}
    }

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

    // Attach schedule_targets and filter schedules by visibility
    const schedList = schedules || [];
    const schedIds = schedList.map((s) => s.schedule_id).filter(Boolean);
    let visibleSchedules = [];
    if (schedIds.length > 0) {
      const placeholders = schedIds.map(() => '?').join(',');
      const [targetsRows] = await pool.query(
        `SELECT schedule_id, target_type, target_value FROM schedule_targets WHERE schedule_id IN (${placeholders})`,
        schedIds
      );
      const targetsById = {};
      for (const t of targetsRows) {
        targetsById[t.schedule_id] = targetsById[t.schedule_id] || [];
        targetsById[t.schedule_id].push({ type: t.target_type, value: t.target_value });
      }

      // Filter according to requester
      for (const s of schedList) {
        const targets = targetsById[s.schedule_id] || [];
        s.targets = targets;
        if (targets.length === 0) {
          visibleSchedules.push(s);
        } else {
          const isGlobal = targets.some((t) => t.type === 'global' || t.value === 'all' || t.value === 'All Barangays');
          const barangayMatch = targets.some((t) => t.type === 'barangay' && t.value && (String(t.value).toLowerCase() === String(barangay || '').toLowerCase() || String(t.value).toLowerCase() === 'all' || String(t.value).toLowerCase() === 'all barangays'));
          const userMatch = targets.some((t) => t.type === 'user' && t.value && String(t.value) === String(req.user?.user_id));
          if (isGlobal || barangayMatch || userMatch) {
            visibleSchedules.push(s);
          }
        }
      }
    } else {
      visibleSchedules = schedList;
    }

    const formattedNotifications = (notifications || []).map((n) => {
      let createdAt = n.created_at;
      if (createdAt instanceof Date) {
        createdAt = createdAt.toISOString();
      } else if (createdAt && typeof createdAt === 'string' && !createdAt.endsWith('Z')) {
        createdAt = new Date(createdAt).toISOString();
      }
      return { ...n, created_at: createdAt };
    });

    return res.status(200).json({
      children,
      nutritionRecords,
      mothers,
      motherServices: motherServices || [],
      childServices: childServices || [],
      programEnrollments: programEnrollments || [],
      mealPlans: mealPlans || [],
      feedingAttendance: feedingAttendance || [],
      feedingSchedule: feedingSchedule && feedingSchedule[0] ? feedingSchedule[0] : null,
      schedules: visibleSchedules,
      referrals,
      notifications: formattedNotifications,
      profilePicture,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Full mobile sync error:', error);
    return res.status(500).json({ message: 'Server error during full sync.' });
  }
};

// ── PROGRAM ENROLLMENT ──
exports.upsertProgramEnrollment = async (req, res) => {
  const { external_id, program_type, beneficiary_type, child_external_id, child_id, mother_external_id, mother_id, beneficiary_name, barangay, enrolled_at, status, notes, unenroll_reason, unenroll_notes } = req.body;
  const scope = enforceScopedBarangay(req.user, barangay || null);
  if (!scope.allowed) {
    return res.status(403).json({
      message: 'Barangay scope mismatch. You can only enroll beneficiaries in your assigned barangay.',
      code: scope.reason,
    });
  }
  const resolvedBarangay = scope.barangay;
  
  // Standardize status: enrolled vs unenrolled
  let resolvedStatus = 'enrolled';
  if (status === 'unenrolled' || status === 'inactive' || status === 'removed') {
    resolvedStatus = 'unenrolled';
  } else if (status === 'enrolled' || status === 'active') {
    resolvedStatus = 'enrolled';
  }
  const enrolledDate = enrolled_at || new Date().toISOString();

  try {
    let resolvedChildId = child_id || null;
    let resolvedMotherId = mother_id || null;
    if (!resolvedChildId && child_external_id) {
      const [[c]] = await pool.query('SELECT child_id, barangay FROM children WHERE external_id = ? OR child_id = ? LIMIT 1', [child_external_id, child_external_id]);
      if (c) {
        if (c.barangay && resolvedBarangay && c.barangay.toLowerCase() !== resolvedBarangay.toLowerCase() && req.user?.role !== 'admin') {
          return res.status(403).json({ message: 'Child belongs to a different barangay.' });
        }
        resolvedChildId = c.child_id;
      }
    }
    if (!resolvedMotherId && mother_external_id) {
      const [[m]] = await pool.query('SELECT mother_id, barangay FROM mothers WHERE external_id = ? OR mother_id = ? LIMIT 1', [mother_external_id, mother_external_id]);
      if (m) {
        if (m.barangay && resolvedBarangay && m.barangay.toLowerCase() !== resolvedBarangay.toLowerCase() && req.user?.role !== 'admin') {
          return res.status(403).json({ message: 'Mother belongs to a different barangay.' });
        }
        resolvedMotherId = m.mother_id;
      }
    }

    const [existing] = await pool.query(
      `SELECT * FROM program_enrollments
       WHERE (external_id IS NOT NULL AND external_id = ?)
          OR (program_type = ? AND child_id IS NOT NULL AND child_id = ?)
          OR (program_type = ? AND mother_id IS NOT NULL AND mother_id = ?)
          OR (program_type = ? AND child_external_id IS NOT NULL AND child_external_id = ?)
       LIMIT 1`,
      [external_id || '', program_type || 'feeding', resolvedChildId || -1, program_type || 'feeding', resolvedMotherId || -1, program_type || 'feeding', child_external_id || '']
    );

    if (existing.length > 0) {
      const current = existing[0];
      const prevStatus = current.status;

      if (resolvedStatus === 'unenrolled' && prevStatus !== 'unenrolled') {
        // UNENROLL: change status only, record reason and date
        const reason = unenroll_reason || req.body.reason || 'Unenrolled by user';
        await pool.query(
          `UPDATE program_enrollments
           SET status = 'unenrolled', unenrolled_at = NOW(), unenrolled_by = ?, unenroll_reason = ?, unenroll_notes = ?, updated_at = NOW()
           WHERE enrollment_id = ?`,
          [req.user?.user_id || null, reason, unenroll_notes || notes || null, current.enrollment_id]
        );
        await pool.query(
          `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason, notes)
           VALUES (?, ?, ?, ?, 'unenrolled', NOW(), ?, ?, ?)`,
          [current.enrollment_id, current.child_id, current.child_external_id, current.barangay, req.user?.user_id || null, reason, unenroll_notes || notes || null]
        );
        return res.status(200).json({ message: 'Beneficiary unenrolled successfully.', enrollment_id: current.enrollment_id, status: 'unenrolled' });
      } else if (resolvedStatus === 'enrolled' && prevStatus === 'unenrolled') {
        // RE-ENROLL: reactivate status, increment cycle, preserve past history
        await pool.query(
          `UPDATE program_enrollments
           SET status = 'enrolled', enrolled_at = NOW(), enrolled_by = ?, unenrolled_at = NULL, unenrolled_by = NULL, unenroll_reason = NULL, unenroll_notes = NULL, cycle_number = cycle_number + 1, updated_at = NOW()
           WHERE enrollment_id = ?`,
          [req.user?.user_id || null, current.enrollment_id]
        );
        await pool.query(
          `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason, notes)
           VALUES (?, ?, ?, ?, 're_enrolled', NOW(), ?, 'Re-enrolled into program', ?)`,
          [current.enrollment_id, current.child_id, current.child_external_id, current.barangay, req.user?.user_id || null, notes || null]
        );
        return res.status(200).json({ message: 'Beneficiary re-enrolled successfully.', enrollment_id: current.enrollment_id, status: 'enrolled' });
      } else {
        await pool.query(
          `UPDATE program_enrollments
           SET notes = COALESCE(?, notes), updated_at = NOW()
           WHERE enrollment_id = ?`,
          [notes || null, current.enrollment_id]
        );
        return res.status(200).json({ message: 'Program enrollment updated successfully.', enrollment_id: current.enrollment_id, status: current.status });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO program_enrollments
       (external_id, program_type, beneficiary_type, child_id, mother_id, child_external_id, mother_external_id, beneficiary_name, barangay, enrolled_at, status, notes, enrolled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', ?, ?)`,
      [
        external_id || null,
        program_type || 'feeding',
        beneficiary_type || (resolvedChildId ? 'child' : 'mother'),
        resolvedChildId,
        resolvedMotherId,
        child_external_id || null,
        mother_external_id || null,
        beneficiary_name || null,
        resolvedBarangay,
        enrolledDate,
        notes || null,
        req.user?.user_id || null,
      ]
    );

    await pool.query(
      `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason, notes)
       VALUES (?, ?, ?, ?, 'enrolled', NOW(), ?, 'Initial program enrollment', ?)`,
      [result.insertId, resolvedChildId, child_external_id || null, resolvedBarangay, req.user?.user_id || null, notes || null]
    );

    return res.status(201).json({ message: 'Enrolled in program successfully.', enrollment_id: result.insertId, status: 'enrolled' });
  } catch (error) {
    console.error('Upsert program enrollment error:', error);
    return res.status(500).json({ message: 'Server error saving program enrollment.' });
  }
};

exports.unenrollProgramBeneficiary = async (req, res) => {
  const { enrollment_id, child_id, child_external_id, reason, notes } = req.body;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM program_enrollments
       WHERE enrollment_id = ? OR child_id = ? OR (child_external_id IS NOT NULL AND child_external_id = ?)
       LIMIT 1`,
      [enrollment_id || -1, child_id || -1, child_external_id || '']
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Enrollment record not found.' });
    }
    const current = rows[0];
    const unenrollReason = reason || 'Unenrolled by user';

    await pool.query(
      `UPDATE program_enrollments
       SET status = 'unenrolled', unenrolled_at = NOW(), unenrolled_by = ?, unenroll_reason = ?, unenroll_notes = ?, updated_at = NOW()
       WHERE enrollment_id = ?`,
      [req.user?.user_id || null, unenrollReason, notes || null, current.enrollment_id]
    );

    await pool.query(
      `INSERT INTO feeding_enrollment_history (enrollment_id, child_id, child_external_id, barangay, action, action_date, action_by, reason, notes)
       VALUES (?, ?, ?, ?, 'unenrolled', NOW(), ?, ?, ?)`,
      [current.enrollment_id, current.child_id, current.child_external_id, current.barangay, req.user?.user_id || null, unenrollReason, notes || null]
    );

    return res.status(200).json({ message: 'Beneficiary unenrolled successfully.', enrollment_id: current.enrollment_id, status: 'unenrolled' });
  } catch (err) {
    console.error('Unenroll error:', err);
    return res.status(500).json({ message: 'Failed to unenroll beneficiary.' });
  }
};

exports.getEnrollmentHistory = async (req, res) => {
  const { enrollment_id, child_id, child_external_id } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT h.*, u.first_name, u.last_name, u.role
       FROM feeding_enrollment_history h
       LEFT JOIN users u ON u.user_id = h.action_by
       WHERE (h.enrollment_id = ? OR h.child_id = ? OR (h.child_external_id IS NOT NULL AND h.child_external_id = ?))
       ORDER BY h.action_date DESC, h.history_id DESC`,
      [enrollment_id || -1, child_id || -1, child_external_id || '']
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Get enrollment history error:', err);
    return res.status(500).json({ message: 'Failed to retrieve enrollment history.' });
  }
};

exports.blockHardDeleteEnrollment = async (req, res) => {
  return res.status(403).json({
    message: 'Hard delete forbidden: Feeding program and enrollment data is permanent. Use unenroll (status update) instead.',
  });
};

exports.getMobileProgramEnrollments = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [rows] = await pool.query(
      `SELECT pe.* FROM program_enrollments pe
       WHERE ${barangay ? 'pe.barangay = ?' : '1=1'}
       ORDER BY pe.enrolled_at DESC`,
      barangay ? [barangay] : []
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get program enrollments error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── MEAL PLANS ──
exports.upsertMealPlan = async (req, res) => {
  const { external_id, barangay, meal_name, ingredients, notes, target_group, effective_from, effective_to } = req.body;
  const scope = enforceScopedBarangay(req.user, barangay || null);
  const resolvedBarangay = scope.barangay;

  try {
    const rawIngredients = typeof ingredients === 'object' ? JSON.stringify(ingredients) : String(ingredients || '');
    const [existing] = await pool.query(
      'SELECT plan_id FROM meal_plans WHERE external_id = ? LIMIT 1',
      [external_id || '']
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE meal_plans
         SET meal_name = ?, ingredients = ?, notes = ?, target_group = ?, updated_at = NOW()
         WHERE plan_id = ?`,
        [meal_name, rawIngredients, notes || null, target_group || null, existing[0].plan_id]
      );
      return res.status(200).json({ message: 'Meal plan updated successfully.', plan_id: existing[0].plan_id });
    }

    const [result] = await pool.query(
      `INSERT INTO meal_plans
       (external_id, barangay, meal_name, ingredients, notes, target_group, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [external_id || null, resolvedBarangay, meal_name, rawIngredients, notes || null, target_group || null, req.user?.user_id || null]
    );

    return res.status(201).json({ message: 'Meal plan created successfully.', plan_id: result.insertId });
  } catch (error) {
    console.error('Upsert meal plan error:', error);
    return res.status(500).json({ message: 'Server error saving meal plan.' });
  }
};

exports.getMobileMealPlans = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM meal_plans WHERE ${barangay ? 'barangay = ?' : '1=1'} ORDER BY created_at DESC`,
      barangay ? [barangay] : []
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get meal plans error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── FEEDING ATTENDANCE ──
exports.recordFeedingAttendance = async (req, res) => {
  const { entries, child_external_id, child_id, barangay, attendance_date, status, meal_served, remarks } = req.body;
  const scope = enforceScopedBarangay(req.user, barangay || null);
  const resolvedBarangay = scope.barangay;

  try {
    const items = Array.isArray(entries) ? entries : [{ child_external_id, child_id, attendance_date, status, meal_served, remarks }];
    for (const item of items) {
      if (!item.child_external_id && !item.child_id) continue;
      let cId = item.child_id || null;
      if (!cId && item.child_external_id) {
        const [[c]] = await pool.query('SELECT child_id FROM children WHERE external_id = ? OR child_id = ? LIMIT 1', [item.child_external_id, item.child_external_id]);
        if (c) cId = c.child_id;
      }
      const attDate = item.attendance_date || new Date().toISOString().slice(0, 10);
      const extKey = `${resolvedBarangay}|${item.child_external_id || cId}|${attDate}`;

      const [existing] = await pool.query(
        `SELECT attendance_id FROM feeding_attendance
         WHERE (external_id = ?)
            OR (child_id IS NOT NULL AND child_id = ? AND attendance_date = ?)
            OR (child_external_id IS NOT NULL AND child_external_id = ? AND attendance_date = ?)
         LIMIT 1`,
        [extKey, cId || -1, attDate, item.child_external_id || '', attDate]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE feeding_attendance
           SET status = ?, meal_served = COALESCE(?, meal_served), remarks = COALESCE(?, remarks)
           WHERE attendance_id = ?`,
          [item.status || 'Present', item.meal_served || null, item.remarks || null, existing[0].attendance_id]
        );
      } else {
        await pool.query(
          `INSERT INTO feeding_attendance
           (external_id, child_id, child_external_id, barangay, attendance_date, status, meal_served, remarks, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [extKey, cId, item.child_external_id || null, resolvedBarangay, attDate, item.status || 'Present', item.meal_served || null, item.remarks || null, req.user?.user_id || null]
        );
      }
    }
    return res.status(200).json({ message: 'Feeding attendance recorded successfully.' });
  } catch (error) {
    console.error('Record feeding attendance error:', error);
    return res.status(500).json({ message: 'Server error saving attendance.' });
  }
};

exports.getMobileFeedingAttendance = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM feeding_attendance WHERE ${barangay ? 'barangay = ?' : '1=1'} ORDER BY attendance_date DESC`,
      barangay ? [barangay] : []
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get feeding attendance error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── FEEDING SCHEDULE ──
exports.upsertFeedingSchedule = async (req, res) => {
  const { barangay, feeding_time, start_time, end_time, venue, days_of_week, target_count, notes } = req.body;
  const scope = enforceScopedBarangay(req.user, barangay || null);
  const resolvedBarangay = scope.barangay;

  try {
    const rawDays = Array.isArray(days_of_week) ? days_of_week.join(', ') : (days_of_week || '');
    const [existing] = await pool.query('SELECT schedule_id FROM feeding_schedules WHERE barangay = ? LIMIT 1', [resolvedBarangay]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE feeding_schedules
         SET feeding_time = ?, start_time = ?, end_time = ?, venue = ?, days_of_week = ?, target_count = ?, notes = ?, updated_by = ?, updated_at = NOW()
         WHERE schedule_id = ?`,
        [feeding_time || '10:00 AM', start_time || null, end_time || null, venue || null, rawDays, target_count || null, notes || null, req.user?.user_id || null, existing[0].schedule_id]
      );
      return res.status(200).json({ message: 'Feeding schedule updated successfully.', schedule_id: existing[0].schedule_id });
    }

    const [result] = await pool.query(
      `INSERT INTO feeding_schedules
       (barangay, feeding_time, start_time, end_time, venue, days_of_week, target_count, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [resolvedBarangay, feeding_time || '10:00 AM', start_time || null, end_time || null, venue || null, rawDays, target_count || null, notes || null, req.user?.user_id || null]
    );

    return res.status(201).json({ message: 'Feeding schedule created successfully.', schedule_id: result.insertId });
  } catch (error) {
    console.error('Upsert feeding schedule error:', error);
    return res.status(500).json({ message: 'Server error saving feeding schedule.' });
  }
};

exports.getMobileFeedingSchedule = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [[row]] = await pool.query('SELECT * FROM feeding_schedules WHERE barangay = ? LIMIT 1', [barangay]);
    return res.status(200).json(row || null);
  } catch (error) {
    console.error('Get feeding schedule error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── CHILD SERVICES (VITAMIN A & DEWORMING) ──
exports.recordChildService = async (req, res) => {
  const { external_id, child_external_id, child_id, service_type, service_name, dosage, service_date, next_schedule, provided_by, notes } = req.body;
  try {
    let resolvedChildId = child_id || null;
    if (!resolvedChildId && child_external_id) {
      const [[c]] = await pool.query('SELECT child_id FROM children WHERE external_id = ? OR child_id = ? LIMIT 1', [child_external_id, child_external_id]);
      if (c) resolvedChildId = c.child_id;
    }
    if (!resolvedChildId) {
      return res.status(400).json({ message: 'Valid child is required.' });
    }

    const sDate = service_date || new Date().toISOString().slice(0, 10);
    const [existing] = await pool.query(
      `SELECT service_id FROM child_services
       WHERE (external_id IS NOT NULL AND external_id = ?)
          OR (child_id = ? AND service_type = ? AND service_date = ?)
       LIMIT 1`,
      [external_id || '', resolvedChildId, service_type, sDate]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE child_services
         SET dosage = COALESCE(?, dosage), service_name = COALESCE(?, service_name), notes = COALESCE(?, notes), provided_by = COALESCE(?, provided_by)
         WHERE service_id = ?`,
        [dosage || null, service_name || null, notes || null, provided_by || null, existing[0].service_id]
      );
      return res.status(200).json({ message: 'Child service updated successfully.', service_id: existing[0].service_id });
    }

    const [result] = await pool.query(
      `INSERT INTO child_services
       (external_id, child_id, service_type, service_name, dosage, service_date, next_schedule, provided_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [external_id || null, resolvedChildId, service_type, service_name || service_type, dosage || null, sDate, next_schedule || null, provided_by || 'BNS', notes || null]
    );

    return res.status(201).json({ message: 'Child service recorded successfully.', service_id: result.insertId });
  } catch (error) {
    console.error('Record child service error:', error);
    return res.status(500).json({ message: 'Server error saving child service.' });
  }
};

exports.getMobileChildServices = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [rows] = await pool.query(
      `SELECT cs.*, c.external_id AS child_external_id
       FROM child_services cs
       INNER JOIN children c ON c.child_id = cs.child_id
       WHERE ${barangay ? 'c.barangay = ?' : '1=1'}
       ORDER BY cs.service_date DESC`,
      barangay ? [barangay] : []
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get child services error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── MOTHER SERVICES (MATERNAL COUNSELING) ──
exports.recordMotherService = async (req, res) => {
  const { external_id, mother_external_id, mother_id, service_type, service_name, dosage, service_date, next_schedule, provided_by, notes } = req.body;
  try {
    let resolvedMotherId = mother_id || null;
    if (!resolvedMotherId && mother_external_id) {
      const [[m]] = await pool.query('SELECT mother_id FROM mothers WHERE external_id = ? OR mother_id = ? LIMIT 1', [mother_external_id, mother_external_id]);
      if (m) resolvedMotherId = m.mother_id;
    }
    if (!resolvedMotherId) {
      return res.status(400).json({ message: 'Valid mother is required.' });
    }

    const sDate = service_date || new Date().toISOString().slice(0, 10);
    const [existing] = await pool.query(
      `SELECT service_id FROM mother_services
       WHERE (external_id IS NOT NULL AND external_id = ?)
          OR (mother_id = ? AND service_type = ? AND service_date = ?)
       LIMIT 1`,
      [external_id || '', resolvedMotherId, service_type || 'Maternal Counseling', sDate]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE mother_services
         SET dosage = COALESCE(?, dosage), service_name = COALESCE(?, service_name), notes = COALESCE(?, notes), provided_by = COALESCE(?, provided_by)
         WHERE service_id = ?`,
        [dosage || null, service_name || null, notes || null, provided_by || null, existing[0].service_id]
      );
      return res.status(200).json({ message: 'Mother service updated successfully.', service_id: existing[0].service_id });
    }

    const [result] = await pool.query(
      `INSERT INTO mother_services
       (external_id, mother_id, service_type, service_name, dosage, service_date, next_schedule, provided_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [external_id || null, resolvedMotherId, service_type || 'Maternal Counseling', service_name || service_type || 'Maternal Counseling', dosage || null, sDate, next_schedule || null, provided_by || 'BNS', notes || null]
    );

    return res.status(201).json({ message: 'Mother service recorded successfully.', service_id: result.insertId });
  } catch (error) {
    console.error('Record mother service error:', error);
    return res.status(500).json({ message: 'Server error saving mother service.' });
  }
};

exports.getMobileMotherServices = async (req, res) => {
  const scope = enforceScopedBarangay(req.user, req.query.barangay || null);
  const barangay = scope.barangay;
  try {
    const [rows] = await pool.query(
      `SELECT ms.*, m.external_id AS mother_external_id
       FROM mother_services ms
       INNER JOIN mothers m ON m.mother_id = ms.mother_id
       WHERE ${barangay ? 'm.barangay = ?' : '1=1'}
       ORDER BY ms.service_date DESC`,
      barangay ? [barangay] : []
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get mother services error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};