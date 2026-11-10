const pool = require('../config/db');
const { canAccessMasterlistItem, canTransferBeneficiary } = require('../utils/roleAccess');
const { logAction } = require('../utils/systemLog');

// ── Common disability options (Step 1) ──────────────────────────────────────
const COMMON_DISABILITIES = [
  'None',
  'Visual Impairment',
  'Hearing Impairment',
  'Physical / Mobility Impairment',
  'Intellectual Disability',
  'Speech / Language Disorder',
  'Autism Spectrum Disorder',
  'Cerebral Palsy',
  'Down Syndrome',
  'Multiple Disabilities',
  'Others',
];

exports.getMasterlistStats = async (req, res) => {
  try {
    const [[childStats]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS totalChildren,
         SUM(CASE WHEN status = 'graduate' THEN 1 ELSE 0 END) AS graduateChildren
       FROM children`
    );

    const [[motherStats]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS totalMothers,
         SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS completedMothers
       FROM mothers`
    );

    return res.status(200).json({
      totalChildren: childStats.totalChildren || 0,
      graduateChildren: childStats.graduateChildren || 0,
      totalMothers: motherStats.totalMothers || 0,
      completedMothers: motherStats.completedMothers || 0,
    });
  } catch (error) {
    console.error('Get masterlist stats error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getChildren = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const barangay = req.user?.barangay;
    const whereClause = role === 'admin' ? '1=1' : 'LOWER(TRIM(c.barangay)) = LOWER(TRIM(?))';
    const params = role === 'admin' ? [] : [barangay];

    const [[{ hasDisability }]] = await pool.query(
      `SELECT COUNT(*) AS hasDisability FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'children' AND COLUMN_NAME = 'disability'`
    );
    const disabilityCol = Number(hasDisability) > 0 ? 'c.disability' : 'NULL AS disability';

    const [children] = await pool.query(
      `SELECT
         c.child_id, c.first_name, c.middle_initial, c.last_name, c.sex, c.age_in_months,
         c.birth_date, c.guardian_name, c.guardian_contact, ${disabilityCol}, c.barangay, c.status,
         CASE
           WHEN c.age_in_months <= 11 THEN '0-11'
           WHEN c.age_in_months <= 23 THEN '12-23'
           ELSE '24-59'
         END AS age_group,
         nr.weight_kg, nr.height_cm,
         CASE
           WHEN nr.overall_status IN ('SAM', 'sam') THEN 'SAM'
           WHEN nr.weight_status IN ('severely_underweight', 'severly_underweight') THEN 'severely_underweight'
           WHEN nr.height_status IN ('severely_stunted', 'severly_stunted') THEN 'severely_stunted'
           WHEN nr.overall_status IN ('MAM', 'mam') THEN 'MAM'
           WHEN nr.height_status = 'stunted' THEN 'stunted'
           WHEN nr.weight_status = 'underweight' THEN 'underweight'
           WHEN nr.weight_status = 'obese' OR nr.overall_status = 'obese' THEN 'obese'
           WHEN nr.weight_status = 'overweight' OR nr.overall_status = 'overweight' THEN 'overweight'
           WHEN nr.record_id IS NULL THEN 'no_record'
           ELSE 'normal'
         END AS overall_status,
         nr.weight_status, nr.height_status,
         nr.record_date AS last_visit
       FROM children c
       LEFT JOIN (
         SELECT nr1.*
         FROM nutrition_records nr1
         INNER JOIN (
           SELECT child_id, MAX(record_id) AS latest_id
           FROM nutrition_records nr_inner
           INNER JOIN (
             SELECT child_id AS cid, MAX(record_date) AS max_date
             FROM nutrition_records
             GROUP BY child_id
           ) m ON nr_inner.child_id = m.cid AND nr_inner.record_date = m.max_date
           GROUP BY child_id
         ) latest ON nr1.record_id = latest.latest_id
       ) nr ON nr.child_id = c.child_id
       WHERE ${whereClause}
       ORDER BY c.first_name ASC`, params
    );

    const filtered = children.filter((child) => canAccessMasterlistItem(req.user, child));
    return res.status(200).json(filtered);
  } catch (error) {
    console.error('Get children error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getMothers = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const barangay = req.user?.barangay;
    const whereClause = role === 'admin' ? '1=1' : 'LOWER(TRIM(m.barangay)) = LOWER(TRIM(?))';
    const params = role === 'admin' ? [] : [barangay];

    const [mothers] = await pool.query(
      `SELECT m.mother_id, m.first_name, m.last_name, m.barangay, m.contact_number, m.status, m.child_id,
              (m.status = 'inactive') AS is_completed
       FROM mothers m
       WHERE ${whereClause}
       ORDER BY m.first_name ASC`, params
    );

    const [linkedChildren] = await pool.query(
      `SELECT child_id, mother_id, first_name, last_name, age_in_months,
         CASE
           WHEN age_in_months <= 11 THEN '0-11'
           WHEN age_in_months <= 23 THEN '12-23'
           ELSE '24-59'
         END AS age_group,
         barangay, status
       FROM children
       WHERE ${role === 'admin' ? '1=1' : 'LOWER(TRIM(barangay)) = LOWER(TRIM(?))'}
       ORDER BY first_name ASC`, role === 'admin' ? [] : [barangay]
    );

    const mothersWithChildren = mothers
      .filter((mother) => canAccessMasterlistItem(req.user, mother))
      .map((mother) => ({
        ...mother,
        is_completed: Boolean(mother.is_completed),
        linked_children: linkedChildren.filter(
          (child) => child.mother_id === mother.mother_id || child.child_id === mother.child_id
        ),
      }));

    return res.status(200).json(mothersWithChildren);
  } catch (error) {
    console.error('Get mothers error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

exports.getBarangays = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT barangay FROM users WHERE barangay IS NOT NULL AND TRIM(barangay) != ''
       UNION
       SELECT DISTINCT barangay FROM children WHERE barangay IS NOT NULL AND TRIM(barangay) != ''`
    );
    const dbBarangays = rows.map((r) => r.barangay.trim()).filter(Boolean);
    const set = new Set([...GASAN_BARANGAYS, ...dbBarangays]);
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return res.status(200).json(list);
  } catch (error) {
    return res.status(200).json(GASAN_BARANGAYS);
  }
};

exports.transferBeneficiary = async (req, res) => {
  const {
    entityType,
    entityId,
    targetBarangay,
    targetBnsUserId,
    reason,
    transferDate,
    alsoTransferLinked,
  } = req.body;

  if (!entityType || !entityId || !targetBarangay) {
    return res.status(400).json({
      message: 'Entity type, id, and destination barangay are required.',
    });
  }

  const role = String(req.user?.role || '').toLowerCase();
  const requesterBarangay = req.user?.barangay || null;

  const table = entityType === 'mother' ? 'mothers' : 'children';
  const idColumn = entityType === 'mother' ? 'mother_id' : 'child_id';

  // Use a dedicated connection for a single atomic transaction
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Ensure transfers table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id VARCHAR(100) NOT NULL,
        record_type VARCHAR(50) NOT NULL,
        from_barangay VARCHAR(100) NOT NULL,
        to_barangay VARCHAR(100) NOT NULL,
        transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        transferred_by VARCHAR(100) NULL,
        reason TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Locate beneficiary by id or external_id
    const [[record]] = await conn.query(
      `SELECT * FROM ${table} WHERE ${idColumn} = ? OR external_id = ? LIMIT 1`,
      [entityId, entityId]
    );

    if (!record) {
      await conn.rollback();
      return res.status(404).json({ message: 'Beneficiary not found.' });
    }

    const fromBarangay = record.barangay || requesterBarangay;

    if (String(fromBarangay).trim().toLowerCase() === String(targetBarangay).trim().toLowerCase()) {
      await conn.commit();
      return res.status(200).json({
        success: true,
        message: `Beneficiary is already in Barangay ${targetBarangay}.`,
        targetBarangay,
        entityId,
        entity_id: record[idColumn],
        alreadyTransferred: true,
      });
    }

    if (role !== 'admin' && !canTransferBeneficiary(req.user, fromBarangay, targetBarangay)) {
      await conn.rollback();
      return res.status(403).json({ message: 'You can only transfer beneficiaries from your assigned barangay.' });
    }

    // Determine target BNS for assignment if available
    let resolvedTargetBns = targetBnsUserId || null;
    if (!resolvedTargetBns) {
      const [[targetBnsRow]] = await conn.query(
        `SELECT user_id FROM users WHERE role = 'bns' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?)) AND status = 'active' LIMIT 1`,
        [targetBarangay]
      );
      if (targetBnsRow) resolvedTargetBns = targetBnsRow.user_id;
    }

    const effectiveDate = transferDate ? new Date(transferDate) : new Date();

    // 3. Update the primary record
    const primaryDbId = record[idColumn];
    const updateParams = resolvedTargetBns
      ? [targetBarangay, resolvedTargetBns, primaryDbId]
      : [targetBarangay, primaryDbId];
    const encodedByClause = resolvedTargetBns ? ', encoded_by = ?' : '';

    await conn.query(
      `UPDATE ${table} SET barangay = ?${encodedByClause}, status = 'active', updated_at = NOW() WHERE ${idColumn} = ?`,
      updateParams
    );

    // 4. Log transfer
    const transferredByUser = req.user?.username || String(req.user?.user_id || 'System');
    await conn.query(
      `INSERT INTO transfers (record_id, record_type, from_barangay, to_barangay, transfer_date, transferred_by, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(record.external_id || primaryDbId),
        entityType,
        fromBarangay,
        targetBarangay,
        effectiveDate,
        transferredByUser,
        reason || 'Beneficiary transferred to new barangay',
      ]
    );

    try {
      await conn.query(
        `INSERT INTO transfer_history (entity_type, entity_id, from_barangay, to_barangay, transferred_by, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entityType, primaryDbId, fromBarangay, targetBarangay, req.user?.user_id || null, reason || 'Transferred', null]
      );
    } catch (_) {}

    // 5. If also transferring linked beneficiary
    const shouldTransferLinked = Boolean(alsoTransferLinked);

    if (entityType === 'child' && shouldTransferLinked && record.mother_id) {
      // Transfer linked mother
      await conn.query(
        `UPDATE mothers SET barangay = ?${encodedByClause}, status = 'active', updated_at = NOW() WHERE mother_id = ?`,
        updateParams.slice(0, -1).concat([record.mother_id])
      );
      await conn.query(
        `INSERT INTO transfers (record_id, record_type, from_barangay, to_barangay, transfer_date, transferred_by, reason)
         VALUES (?, 'mother', ?, ?, ?, ?, ?)`,
        [String(record.mother_id), fromBarangay, targetBarangay, effectiveDate, transferredByUser, 'Linked child transfer']
      );
    } else if (entityType === 'mother' && shouldTransferLinked) {
      // Transfer all linked children
      const [linkedKids] = await conn.query(
        `SELECT child_id, external_id FROM children WHERE mother_id = ?`,
        [primaryDbId]
      );
      for (const kid of linkedKids) {
        await conn.query(
          `UPDATE children SET barangay = ?${encodedByClause}, status = 'active', updated_at = NOW() WHERE child_id = ?`,
          updateParams.slice(0, -1).concat([kid.child_id])
        );
        await conn.query(
          `INSERT INTO transfers (record_id, record_type, from_barangay, to_barangay, transfer_date, transferred_by, reason)
           VALUES (?, 'child', ?, ?, ?, ?, ?)`,
          [String(kid.external_id || kid.child_id), fromBarangay, targetBarangay, effectiveDate, transferredByUser, 'Linked mother transfer']
        );
      }
    }

    // 6. Notify active BNS & BHW of the new target barangay
    // 6. Notify active BNS & BHW of the new target barangay
    const beneficiaryFullName = `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Beneficiary';
    const notifTitle = `Bagong lipat: ${beneficiaryFullName} mula sa ${fromBarangay}`;
    const notifMessage = `Si ${beneficiaryFullName} ay inilipat sa inyong barangay (${targetBarangay}) mula sa Barangay ${fromBarangay}.`;

    try {
      await conn.query(
        `INSERT INTO notifications (title, message, type, is_read, related_id, created_by, recipient_role, barangay, created_at)
         VALUES (?, ?, 'alert', FALSE, ?, ?, 'bhw', ?, NOW())`,
        [notifTitle, notifMessage, primaryDbId, req.user?.user_id || null, targetBarangay]
      );
    } catch (notifErr) {
      console.warn('Transfer notification warning (non-fatal):', {
        code: notifErr.code,
        sqlMessage: notifErr.sqlMessage,
        message: notifErr.message,
      });
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Beneficiary successfully transferred to Barangay ${targetBarangay}.`,
      targetBarangay,
      entityId,
      entity_id: primaryDbId,
    });
  } catch (error) {
    // A. Log real SQL error before rollback
    console.error('Transfer beneficiary SQL error:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      payload: req.body,
      message: error.message,
    });

    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error('Rollback error during transfer failure:', rbErr);
    }

    const sqlMsg = error.sqlMessage || error.message || 'Unknown database error';
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ message: `Duplicate entry during transfer: ${sqlMsg}`, code: error.code });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW' || error.errno === 1452) {
      return res.status(400).json({ message: `Missing reference during transfer: ${sqlMsg}`, code: error.code });
    }
    if (error.code === 'ER_BAD_NULL_ERROR' || error.code === 'ER_TRUNCATED_WRONG_VALUE' || error.errno === 1048 || error.errno === 1265) {
      return res.status(400).json({ message: `Invalid data format during transfer: ${sqlMsg}`, code: error.code });
    }
    return res.status(500).json({ message: `Server error during transfer: ${sqlMsg}`, code: error.code || 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
};

exports.checkDuplicate = async (req, res) => {
  try {
    const { type, targetBarangay, fullName, birthDate } = req.query;
    if (!targetBarangay || !fullName) {
      return res.status(200).json({ duplicateExists: false });
    }
    const table = type === 'mother' ? 'mothers' : 'children';
    const cleanName = fullName.trim();
    const cleanBarangay = targetBarangay.trim();

    let query = `SELECT * FROM ${table} WHERE LOWER(TRIM(barangay)) = LOWER(TRIM(?))`;
    const params = [cleanBarangay];

    query += ` AND (
      LOWER(TRIM(CONCAT_WS(' ', first_name, last_name))) = LOWER(TRIM(?))
      OR LOWER(TRIM(CONCAT_WS(' ', first_name, middle_initial, last_name))) = LOWER(TRIM(?))
      OR LOWER(TRIM(first_name)) = LOWER(TRIM(?))
    )`;
    params.push(cleanName, cleanName, cleanName);

    if (birthDate) {
      const cleanBirth = String(birthDate).split('T')[0];
      query += ` AND DATE(birth_date) = ?`;
      params.push(cleanBirth);
    }

    query += ` LIMIT 1`;

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      duplicateExists: rows.length > 0,
      existing: rows.length > 0 ? rows[0] : null,
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    return res.status(500).json({ message: 'Error checking duplicate', duplicateExists: false });
  }
};

// ── Step 1: Expose disability options ────────────────────────────────────────
exports.getDisabilityOptions = async (_req, res) => {
  return res.status(200).json(COMMON_DISABILITIES);
};

// ── Steps 1 & 9: Create a child record with validation ───────────────────────
exports.createChild = async (req, res) => {
  const {
    first_name, middle_initial, last_name, sex, birth_date,
    barangay, purok, municipality,
    guardian_name, guardian_contact,
    disability, mother_id,
  } = req.body;

  // Required field validation (Step 1)
  const missing = [];
  if (!first_name || !first_name.trim()) missing.push('first_name');
  if (!last_name  || !last_name.trim())  missing.push('last_name');
  if (!sex)                              missing.push('sex');
  if (!birth_date)                       missing.push('birth_date');
  if (!barangay   || !barangay.trim())   missing.push('barangay');
  if (!guardian_contact || !guardian_contact.trim()) missing.push('guardian_contact');

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missing.join(', ')}`,
      missing,
    });
  }

  try {
    const ageInMonths = Math.max(0, Math.floor(
      (Date.now() - new Date(birth_date).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
    ));

    const [result] = await pool.query(
      `INSERT INTO children
         (first_name, middle_initial, last_name, sex, birth_date, age_in_months,
          barangay, purok, municipality, guardian_name, guardian_contact,
          disability, mother_id, encoded_by, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active', NOW(), NOW())`,
      [
        first_name.trim(), middle_initial || null, last_name.trim(), sex, birth_date,
        ageInMonths,
        barangay.trim(), purok || null, municipality || 'Gasan',
        guardian_name || null, guardian_contact.trim(),
        disability || 'None', mother_id || null, req.user?.user_id || null,
      ]
    );

    await logAction(pool, req, 'CREATE_CHILD', 'child', result.insertId, {
      name: `${first_name} ${last_name}`, barangay,
    });

    return res.status(201).json({ message: 'Child record created.', child_id: result.insertId });
  } catch (err) {
    console.error('Create child error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── Steps 1 & 9: Update a child record with validation ───────────────────────
exports.updateChild = async (req, res) => {
  const { id } = req.params;
  const {
    first_name, middle_initial, last_name, sex, birth_date,
    barangay, purok, municipality,
    guardian_name, guardian_contact, disability,
  } = req.body;

  const missing = [];
  if (!guardian_contact || !guardian_contact.trim()) missing.push('guardian_contact');
  if (!birth_date)                                   missing.push('birth_date');

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missing.join(', ')}`,
      missing,
    });
  }

  try {
    const [[existing]] = await pool.query(
      `SELECT * FROM children WHERE child_id = ?`, [id]
    );
    if (!existing) {
      return res.status(404).json({ message: 'Child not found.' });
    }

    const ageInMonths = Math.max(0, Math.floor(
      (Date.now() - new Date(birth_date || existing.birth_date).getTime()) /
      (1000 * 60 * 60 * 24 * 30.4375)
    ));

    await pool.query(
      `UPDATE children SET
         first_name = ?, middle_initial = ?, last_name = ?, sex = ?,
         birth_date = ?, age_in_months = ?,
         barangay = ?, purok = ?, municipality = ?,
         guardian_name = ?, guardian_contact = ?,
         disability = ?, updated_at = NOW()
       WHERE child_id = ?`,
      [
        (first_name || existing.first_name).trim(),
        middle_initial !== undefined ? middle_initial : existing.middle_initial,
        (last_name || existing.last_name).trim(),
        sex || existing.sex,
        birth_date || existing.birth_date,
        ageInMonths,
        (barangay || existing.barangay).trim(),
        purok !== undefined ? purok : existing.purok,
        municipality || existing.municipality || 'Gasan',
        guardian_name !== undefined ? guardian_name : existing.guardian_name,
        guardian_contact.trim(),
        disability !== undefined ? disability : existing.disability,
        id,
      ]
    );

    await logAction(pool, req, 'UPDATE_CHILD', 'child', Number(id), {
      before: { name: `${existing.first_name} ${existing.last_name}` },
      after:  { guardian_contact, disability },
    });

    return res.status(200).json({ message: 'Child record updated.' });
  } catch (err) {
    console.error('Update child error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── Step 4: Feeding history + effectiveness for a child ──────────────────────
exports.getChildFeedingHistory = async (req, res) => {
  const { id } = req.params;
  try {
    // All feeding programs for this child
    const [programs] = await pool.query(
      `SELECT fp.feeding_id, fp.status AS program_status, fp.start_date, fp.end_date
       FROM feeding_programs fp
       WHERE fp.child_id = ?
       ORDER BY fp.start_date DESC`,
      [id]
    );

    // For each program get attendance + meals
    const history = [];
    for (const prog of programs) {
      const [attendance] = await pool.query(
        `SELECT fa.attendance_id, fa.feeding_date, fa.status, fa.remarks
         FROM feeding_attendance fa
         WHERE fa.feeding_id = ?
         ORDER BY fa.feeding_date DESC`,
        [prog.feeding_id]
      );

      for (const att of attendance) {
        const [meals] = await pool.query(
          `SELECT meal_id, meal_description, calories, notes
           FROM feeding_meals
           WHERE attendance_id = ?`,
          [att.attendance_id]
        );
        att.meals = meals;
      }

      // Effectiveness: compare first vs latest nutrition record during the program window
      let effectiveness = null;
      if (prog.start_date) {
        const [[first]] = await pool.query(
          `SELECT overall_status, weight_kg, height_cm, record_date
           FROM nutrition_records
           WHERE child_id = ?
             AND record_date >= ?
           ORDER BY record_date ASC
           LIMIT 1`,
          [id, prog.start_date]
        );
        const endBound = prog.end_date || new Date().toISOString().slice(0, 10);
        const [[latest]] = await pool.query(
          `SELECT overall_status, weight_kg, height_cm, record_date
           FROM nutrition_records
           WHERE child_id = ?
             AND record_date <= ?
           ORDER BY record_date DESC
           LIMIT 1`,
          [id, endBound]
        );
        if (first && latest && first.record_date !== latest.record_date) {
          effectiveness = { before: first, after: latest };
        }
      }

      history.push({ ...prog, attendance, effectiveness });
    }

    return res.status(200).json(history);
  } catch (err) {
    console.error('Get feeding history error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── Step 4: Add a meal to an attendance record ───────────────────────────────
exports.addFeedingMeal = async (req, res) => {
  const { attendance_id } = req.params;
  const { meal_description, calories, notes } = req.body;

  if (!meal_description || !meal_description.trim()) {
    return res.status(400).json({ message: 'meal_description is required.' });
  }

  try {
    const [[att]] = await pool.query(
      `SELECT fa.attendance_id, fa.feeding_id, fp.child_id
       FROM feeding_attendance fa
       JOIN feeding_programs fp ON fa.feeding_id = fp.feeding_id
       WHERE fa.attendance_id = ?`,
      [attendance_id]
    );
    if (!att) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    const [result] = await pool.query(
      `INSERT INTO feeding_meals (attendance_id, meal_description, calories, notes, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [attendance_id, meal_description.trim().slice(0, 255), calories || null, notes || null]
    );

    await logAction(pool, req, 'ADD_FEEDING_MEAL', 'child', att.child_id, {
      meal_id: result.insertId, meal_description,
    });

    return res.status(201).json({ message: 'Meal recorded.', meal_id: result.insertId });
  } catch (err) {
    console.error('Add feeding meal error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── Step 5: Absence history for a child ─────────────────────────────────────
exports.getChildAbsences = async (req, res) => {
  const { id } = req.params;
  try {
    const [absences] = await pool.query(
      `SELECT fa.attendance_id, fa.feeding_date, fa.status, fa.remarks,
              fp.feeding_id, fp.start_date AS program_start
       FROM feeding_attendance fa
       JOIN feeding_programs fp ON fa.feeding_id = fp.feeding_id
       WHERE fp.child_id = ?
         AND fa.status = 'absent'
       ORDER BY fa.feeding_date DESC`,
      [id]
    );
    return res.status(200).json(absences);
  } catch (err) {
    console.error('Get absence history error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
