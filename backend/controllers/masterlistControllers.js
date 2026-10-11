const pool = require('../config/db');
const { canAccessMasterlistItem, canTransferBeneficiary } = require('../utils/roleAccess');

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

    const [children] = await pool.query(
      `SELECT
         c.child_id, c.first_name, c.last_name, c.sex, c.age_in_months,
         CASE
           WHEN c.age_in_months <= 11 THEN '0-11'
           WHEN c.age_in_months <= 23 THEN '12-23'
           ELSE '24-59'
         END AS age_group,
         c.guardian_name, c.barangay, c.status,
         nr.weight_kg, nr.height_cm, nr.overall_status, nr.record_date AS last_visit
       FROM children c
       LEFT JOIN (
         SELECT nr1.*
         FROM nutrition_records nr1
         INNER JOIN (
           SELECT child_id, MAX(record_id) AS max_id
           FROM nutrition_records
           GROUP BY child_id
         ) nr2 ON nr1.record_id = nr2.max_id
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
      await conn.rollback();
      return res.status(400).json({ message: 'Target barangay must be different from current barangay.' });
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
    const [targetStaff] = await conn.query(
      `SELECT user_id FROM users WHERE LOWER(TRIM(barangay)) = LOWER(TRIM(?)) AND status = 'active'`,
      [targetBarangay]
    );

    const beneficiaryFullName = `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Beneficiary';
    const notifTitle = `Bagong lipat: ${beneficiaryFullName} mula sa ${fromBarangay}`;
    const notifMessage = `Si ${beneficiaryFullName} ay inilipat sa inyong barangay (${targetBarangay}) mula sa Barangay ${fromBarangay}.`;

    if (targetStaff.length > 0) {
      for (const staff of targetStaff) {
        await conn.query(
          `INSERT INTO notifications (user_id, title, message, type, is_read, related_id, created_at)
           VALUES (?, ?, ?, 'alert', FALSE, ?, NOW())`,
          [staff.user_id, notifTitle, notifMessage, primaryDbId]
        );
      }
    } else {
      // Global/broadcast notification if no specific user mapped yet
      await conn.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, related_id, created_at)
         VALUES (NULL, ?, ?, 'alert', FALSE, ?, NOW())`,
        [notifTitle, notifMessage, primaryDbId]
      );
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Beneficiary successfully transferred to Barangay ${targetBarangay}.`,
      targetBarangay,
      entityId,
    });
  } catch (error) {
    await conn.rollback();
    console.error('Transfer beneficiary transaction error:', error);
    return res.status(500).json({ message: 'Server error during transfer. Rolled back changes.' });
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

