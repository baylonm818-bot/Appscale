const pool = require('../config/db');

exports.getMedicalRecordsList = async (req, res) => {
  const { barangay } = req.query;

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const role = String(req.user?.role || '').toLowerCase();
    let scopeClause = '';
    let scopeParams = [];

    if (role === 'bns') {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_DATABASE || process.env.DB_NAME || 'appscale_db', 'children', 'encoded_by']
      );

      if (Number(cnt) > 0) {
        scopeClause = 'AND (c.encoded_by IS NULL OR c.encoded_by = ?)';
        scopeParams = [req.user.user_id];
      }
    }

    const [children] = await pool.query(
      `SELECT
         c.child_id, c.first_name, c.last_name, c.sex, c.age_in_months, c.guardian_name,
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
       WHERE c.barangay = ? AND c.status = 'active' ${scopeClause}
       ORDER BY c.first_name ASC`,
      [barangay, ...scopeParams]
    );
    return res.status(200).json(children);
  } catch (error) {
    console.error('Get medical records list error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getChildMedicalHistory = async (req, res) => {
  const { childId } = req.params;

  try {
    const [nutritionHistory] = await pool.query(
      `SELECT record_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
              weight_status, height_status, overall_status
       FROM nutrition_records
       WHERE child_id = ?
       ORDER BY record_date DESC`,
      [childId]
    );

    const [[serviceTypesRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      ['service_types']
    );

    const hasServiceTypesTable = Number(serviceTypesRow?.cnt || 0) > 0;

    const [servicesHistory] = await pool.query(
      hasServiceTypesTable
        ? `SELECT cs.service_id, cs.service_date, cs.next_schedule, cs.provided_by, st.type_name
            FROM child_services cs
            LEFT JOIN service_types st ON st.type_name = cs.service_type
            WHERE cs.child_id = ?
            ORDER BY cs.service_date DESC`
        : `SELECT cs.service_id, cs.service_date, cs.next_schedule, cs.provided_by, cs.service_type AS type_name
            FROM child_services cs
            WHERE cs.child_id = ?
            ORDER BY cs.service_date DESC`,
      [childId]
    );

    return res.status(200).json({ nutritionHistory, servicesHistory });
  } catch (error) {
    console.error('Get child medical history error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};