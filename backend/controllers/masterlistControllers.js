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

exports.transferBeneficiary = async (req, res) => {
  const { entityType, entityId, targetBarangay, targetBnsUserId, reason } = req.body;

  if (!entityType || !entityId || !targetBarangay || !targetBnsUserId) {
    return res.status(400).json({ message: 'Entity type, id, destination barangay, and target BNS are required.' });
  }

  const role = String(req.user?.role || '').toLowerCase();
  const fromBarangay = req.user?.barangay || null;

  if (role !== 'admin' && !canTransferBeneficiary(req.user, fromBarangay, targetBarangay)) {
    return res.status(403).json({ message: 'You can only transfer records within your own barangay.' });
  }

  try {
    const table = entityType === 'mother' ? 'mothers' : 'children';
    const idColumn = entityType === 'mother' ? 'mother_id' : 'child_id';
    const [[record]] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [entityId]);
    if (!record) {
      return res.status(404).json({ message: 'Beneficiary not found.' });
    }

    await pool.query(`UPDATE ${table} SET barangay = ?, updated_at = NOW() WHERE ${idColumn} = ?`, [targetBarangay, entityId]);

    await pool.query(
      `INSERT INTO archive_records (table_name, record_id, snapshot, reason, archived_by, archived_at)
       VALUES (?, ?, ?, 'transfer', ?, NOW())`,
      [table, entityId, JSON.stringify(record), req.user?.user_id || null]
    );

    try {
      await pool.query(
        `INSERT INTO transfer_history (entity_type, entity_id, from_barangay, to_barangay, transferred_by, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entityType, entityId, record.barangay || fromBarangay, targetBarangay, req.user?.user_id || null, reason || 'Transferred by admin', null]
      );
    } catch (_) {}

    await pool.query(
      `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
       VALUES (?, ?, 'system', FALSE, ?, NOW())`,
      [`Beneficiary transferred: ${record.first_name || 'Record'} ${record.last_name || ''}`.trim(), `A ${entityType} record moved from ${record.barangay || fromBarangay} to ${targetBarangay}.`, entityId]
    );

    return res.status(200).json({ message: 'Beneficiary transferred successfully.' });
  } catch (error) {
    console.error('Transfer beneficiary error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
