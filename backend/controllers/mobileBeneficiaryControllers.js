const pool = require('../config/db');

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.pop() || '',
    middleInitial: parts.join(' ') || null,
  };
}

exports.upsertChild = async (req, res) => {
  const { external_id, full_name, birth_date, gender, address, barangay, guardian_name, guardian_contact, mother_external_id, encoded_by } = req.body;
  if (!external_id || !full_name || !birth_date || !gender || !address || !barangay || !guardian_name) {
    return res.status(400).json({ message: 'Child name, birth date, gender, address, barangay, guardian, and external ID are required.' });
  }

  try {
    const name = splitName(full_name);
    const [existing] = await pool.query('SELECT child_id FROM children WHERE external_id = ? LIMIT 1', [external_id]);
    const [[mother]] = mother_external_id
      ? await pool.query('SELECT mother_id FROM mothers WHERE external_id = ? LIMIT 1', [mother_external_id])
      : [[]];
    const motherId = mother?.mother_id || null;
    if (existing.length > 0) {
      await pool.query(
        `UPDATE children SET first_name = ?, middle_initial = ?, last_name = ?, birth_date = ?, sex = ?,
         age_in_months = TIMESTAMPDIFF(MONTH, ?, CURDATE()), age_group = CASE WHEN TIMESTAMPDIFF(MONTH, ?, CURDATE()) < 24 THEN '0-23' ELSE '24-59' END,
         barangay = ?, guardian_name = ?, guardian_contact = ?, mother_id = ?, encoded_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE external_id = ?`,
        [name.firstName, name.middleInitial, name.lastName, birth_date, gender, birth_date, birth_date, barangay, guardian_name, guardian_contact || null, motherId, encoded_by || null, external_id]
      );
      return res.status(200).json({ message: 'Child synced.', child_id: existing[0].child_id });
    }

    const [result] = await pool.query(
      `INSERT INTO children (external_id, first_name, middle_initial, last_name, birth_date, sex, age_in_months, age_group,
       municipality, barangay, purok, guardian_name, guardian_contact, mother_id, status, encoded_by)
       VALUES (?, ?, ?, ?, ?, ?, TIMESTAMPDIFF(MONTH, ?, CURDATE()), CASE WHEN TIMESTAMPDIFF(MONTH, ?, CURDATE()) < 24 THEN '0-23' ELSE '24-59' END,
       NULL, ?, NULL, ?, ?, ?, 'active', ?)`,
      [external_id, name.firstName, name.middleInitial, name.lastName, birth_date, gender, birth_date, birth_date, barangay, guardian_name, guardian_contact || null, motherId, encoded_by || null]
    );
    return res.status(201).json({ message: 'Child synced.', child_id: result.insertId });
  } catch (error) {
    console.error('Sync child error:', error);
    return res.status(500).json({ message: 'Unable to sync child.' });
  }
};

exports.upsertMother = async (req, res) => {
  const { external_id, full_name, birth_date, contact_number, address, barangay, encoded_by, linked_child_external_ids } = req.body;
  if (!external_id || !full_name || !birth_date || !address || !barangay) {
    return res.status(400).json({ message: 'Mother name, birth date, address, barangay, and external ID are required.' });
  }

  try {
    const name = splitName(full_name);
    const [existing] = await pool.query('SELECT mother_id FROM mothers WHERE external_id = ? LIMIT 1', [external_id]);
    const linkedChildIds = Array.isArray(linked_child_external_ids) && linked_child_external_ids.length > 0
      ? await pool.query('SELECT child_id FROM children WHERE external_id IN (?)', [linked_child_external_ids])
      : [[]];
    const childId = linkedChildIds[0]?.length === 1 ? linkedChildIds[0][0].child_id : null;
    const values = [name.firstName, name.middleInitial, name.lastName, birth_date, contact_number || null, barangay, address, childId, encoded_by || null];

    if (existing.length > 0) {
      await pool.query(
        `UPDATE mothers SET first_name = ?, middle_initial = ?, last_name = ?, birth_date = ?, contact_number = ?,
         barangay = ?, purok = ?, child_id = ?, encoded_by = ?, updated_at = CURRENT_TIMESTAMP WHERE external_id = ?`,
        [...values, external_id]
      );
      return res.status(200).json({ message: 'Mother synced.', mother_id: existing[0].mother_id });
    }

    const [result] = await pool.query(
      `INSERT INTO mothers (external_id, first_name, middle_initial, last_name, birth_date, municipality, barangay, purok,
       contact_number, child_id, status, encoded_by)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?)`,
      [external_id, name.firstName, name.middleInitial, name.lastName, birth_date, barangay, address, contact_number || null, childId, encoded_by || null]
    );
    return res.status(201).json({ message: 'Mother synced.', mother_id: result.insertId });
  } catch (error) {
    console.error('Sync mother error:', error);
    return res.status(500).json({ message: 'Unable to sync mother.' });
  }
};