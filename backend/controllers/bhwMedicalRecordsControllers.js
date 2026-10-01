const pool = require('../config/db');
const { ensureMedicalRecordTables, buildChildServiceInsert, buildMotherServiceInsert } = require('../utils/medicalSchema');

exports.getMedicalRecordsList = async (req, res) => {
  let { barangay } = req.query;
  const role = String(req.user?.role || '').toLowerCase();

  // SECURITY FIX: Enforce barangay check for non-admins to prevent IDOR
  if (role !== 'admin') {
      if (req.user?.barangay) {
          barangay = req.user.barangay; // Force the query to use the assigned barangay
      } else {
          return res.status(403).json({ message: 'Unauthorized: No assigned barangay for this user.' });
      }
  }

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [children] = await pool.query(
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
      [barangay, barangay]
    );
    return res.status(200).json(children);
  } catch (error) {
    console.error('Get medical records list error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getMothersList = async (req, res) => {
  let { barangay } = req.query;
  const role = String(req.user?.role || '').toLowerCase();

  if (role !== 'admin') {
    if (req.user?.barangay) {
      barangay = req.user.barangay;
    } else {
      return res.status(403).json({ message: 'Unauthorized: No assigned barangay.' });
    }
  }

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [mothers] = await pool.query(
      `SELECT
         m.mother_id,
         m.first_name,
         m.last_name,
         m.birth_date,
         m.contact_number,
         m.purok,
         m.barangay,
         m.status,
         m.created_at,
         TIMESTAMPDIFF(YEAR, m.birth_date, CURDATE()) AS age_years,
         COUNT(c.child_id) AS child_count
       FROM mothers m
       LEFT JOIN children c ON c.guardian_name = CONCAT(m.first_name, ' ', m.last_name)
         AND c.barangay = m.barangay AND c.status = 'active'
       WHERE m.barangay = ? AND m.status = 'active'
       GROUP BY m.mother_id
       ORDER BY m.first_name ASC`,
      [barangay]
    );
    return res.status(200).json(mothers);
  } catch (error) {
    console.error('Get mothers list error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getChildMedicalHistory = async (req, res) => {
  const { childId } = req.params;
  const role = String(req.user?.role || '').toLowerCase();

  try {
    const [[child]] = await pool.query(
      'SELECT child_id, first_name, last_name, barangay, age_in_months, sex FROM children WHERE child_id = ?',
      [childId]
    );
    if (!child) return res.status(404).json({ message: 'Child not found.' });

    if (role !== 'admin') {
      if (!req.user?.barangay || child.barangay !== req.user.barangay) {
        return res.status(403).json({ message: 'Forbidden: This child does not belong to your barangay.' });
      }
    }

    const [nutritionHistory] = await pool.query(
      `SELECT record_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
              weight_status, height_status, overall_status, bmi, bmi_status
       FROM nutrition_records
       WHERE child_id = ?
       ORDER BY record_date DESC`,
      [childId]
    );

    const [servicesHistory] = await pool.query(
      `SELECT cs.service_id, cs.service_date, cs.service_type, cs.service_name, cs.dosage,
              cs.next_schedule, cs.provided_by, cs.notes
       FROM child_services cs
       WHERE cs.child_id = ?
       ORDER BY cs.service_date DESC, cs.service_id DESC`,
      [childId]
    );

    const [referrals] = await pool.query(
      `SELECT referral_id, reason, severity, status, notes, created_at
       FROM referrals
       WHERE child_id = ?
       ORDER BY created_at DESC`,
      [childId]
    );

    return res.status(200).json({ child, nutritionHistory, servicesHistory, referrals });
  } catch (error) {
    console.error('Get child medical history error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getMotherMedicalHistory = async (req, res) => {
  const { motherId } = req.params;
  const role = String(req.user?.role || '').toLowerCase();

  try {
    const [[mother]] = await pool.query(
      'SELECT mother_id, first_name, last_name, birth_date, contact_number, purok, barangay, status FROM mothers WHERE mother_id = ?',
      [motherId]
    );
    if (!mother) return res.status(404).json({ message: 'Mother not found.' });

    if (role !== 'admin') {
      if (!req.user?.barangay || mother.barangay !== req.user.barangay) {
        return res.status(403).json({ message: 'Forbidden: This mother does not belong to your barangay.' });
      }
    }

    const [servicesHistory] = await pool.query(
      `SELECT service_id, service_date, service_type, service_name, dosage,
              next_schedule, provided_by, notes, created_at
       FROM mother_services
       WHERE mother_id = ?
       ORDER BY service_date DESC, service_id DESC`,
      [motherId]
    );

    const [referrals] = await pool.query(
      `SELECT referral_id, reason, severity, status, notes, created_at
       FROM referrals
       WHERE mother_id = ?
       ORDER BY created_at DESC`,
      [motherId]
    );

    const [children] = await pool.query(
      `SELECT child_id, first_name, last_name, age_in_months, sex, status
       FROM children
       WHERE guardian_name = CONCAT(?, ' ', ?) OR mother_id = ?`,
      [mother.first_name, mother.last_name, motherId]
    );

    return res.status(200).json({ mother, servicesHistory, referrals, children });
  } catch (error) {
    console.error('Get mother medical history error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * Record medication, supplement, or health intervention for Child
 * Module 4 Requirement: "The system shall enable BHW to record and monitor medications, supplements, and health interventions provided to children and lactating mothers."
 * Module 4 Requirement: "The system shall maintain an audit trail to track all modifications made to medical records, including the user and timestamp."
 */
exports.createChildMedicalRecord = async (req, res) => {
  const { child_id, service_type, service_name, dosage, service_date, next_schedule, notes } = req.body;
  const userId = req.user?.user_id;
  const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'BHW User';

  if (!child_id || !service_type || !service_date) {
    return res.status(400).json({ message: 'Child ID, service type, and service date are required.' });
  }

  try {
    await ensureMedicalRecordTables(pool);

    const [[child]] = await pool.query('SELECT child_id, first_name, last_name, barangay FROM children WHERE child_id = ?', [child_id]);
    if (!child) return res.status(404).json({ message: 'Child not found.' });

    const [columns] = await pool.query('SHOW COLUMNS FROM child_services');
    const availableColumns = columns.map((column) => column.Field);
    const insertConfig = buildChildServiceInsert({
      child_id,
      service_type,
      service_name: service_name || null,
      dosage: dosage || null,
      service_date,
      next_schedule: next_schedule || null,
      provided_by: userName,
      notes: notes || null,
    }, availableColumns);

    const [result] = await pool.query(insertConfig.sql, insertConfig.values);

    // Audit trail logging
    const actionDetails = `Recorded ${service_type}${service_name ? ': ' + service_name : ''} (Dosage: ${dosage || 'N/A'}, Date: ${service_date})`;
    await pool.query(
      `INSERT INTO medical_records_audit_trail (record_type, record_id, beneficiary_type, beneficiary_id, beneficiary_name, action, action_details, modified_by, modifier_name, timestamp)
       VALUES ('child_services', ?, 'child', ?, ?, 'CREATE', ?, ?, ?, NOW())`,
      [result.insertId, child_id, `${child.first_name} ${child.last_name}`, actionDetails, userId, userName]
    );

    return res.status(201).json({ message: 'Medical intervention recorded successfully.', service_id: result.insertId });
  } catch (error) {
    console.error('Create child medical record error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * Record medication, supplement, or health intervention for Lactating Mother
 */
exports.createMotherMedicalRecord = async (req, res) => {
  const { mother_id, service_type, service_name, dosage, service_date, next_schedule, notes } = req.body;
  const userId = req.user?.user_id;
  const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'BHW User';

  if (!mother_id || !service_type || !service_date) {
    return res.status(400).json({ message: 'Mother ID, service type, and service date are required.' });
  }

  try {
    await ensureMedicalRecordTables(pool);

    const [[mother]] = await pool.query('SELECT mother_id, first_name, last_name, barangay FROM mothers WHERE mother_id = ?', [mother_id]);
    if (!mother) return res.status(404).json({ message: 'Mother not found.' });

    const [columns] = await pool.query('SHOW COLUMNS FROM mother_services');
    const availableColumns = columns.map((column) => column.Field);
    const insertConfig = buildMotherServiceInsert({
      mother_id,
      service_type,
      service_name: service_name || null,
      dosage: dosage || null,
      service_date,
      next_schedule: next_schedule || null,
      provided_by: userName,
      notes: notes || null,
    }, availableColumns);

    const [result] = await pool.query(insertConfig.sql, insertConfig.values);

    // Audit trail logging
    const actionDetails = `Recorded ${service_type}${service_name ? ': ' + service_name : ''} (Dosage: ${dosage || 'N/A'}, Date: ${service_date})`;
    await pool.query(
      `INSERT INTO medical_records_audit_trail (record_type, record_id, beneficiary_type, beneficiary_id, beneficiary_name, action, action_details, modified_by, modifier_name, timestamp)
       VALUES ('mother_services', ?, 'mother', ?, ?, 'CREATE', ?, ?, ?, NOW())`,
      [result.insertId, mother_id, `${mother.first_name} ${mother.last_name}`, actionDetails, userId, userName]
    );

    return res.status(201).json({ message: 'Medical intervention recorded successfully.', service_id: result.insertId });
  } catch (error) {
    console.error('Create mother medical record error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * Get Audit Trail
 * Module 4 Requirement: "The system shall maintain an audit trail to track all modifications made to medical records, including the user and timestamp."
 */
exports.getMedicalRecordsAuditTrail = async (req, res) => {
  const { beneficiaryType, beneficiaryId } = req.query;

  try {
    let query = `
      SELECT audit_id, record_type, record_id, beneficiary_type, beneficiary_id,
             beneficiary_name, action, action_details, modified_by, modifier_name, timestamp
      FROM medical_records_audit_trail
    `;
    const params = [];

    if (beneficiaryType && beneficiaryId) {
      query += ` WHERE beneficiary_type = ? AND beneficiary_id = ?`;
      params.push(beneficiaryType, beneficiaryId);
    }

    query += ` ORDER BY timestamp DESC LIMIT 100`;

    const [logs] = await pool.query(query, params);
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Get medical records audit trail error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};