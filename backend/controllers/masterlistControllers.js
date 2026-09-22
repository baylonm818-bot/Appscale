const pool = require('../config/db');

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
    const [children] = await pool.query(
      `SELECT
         c.child_id, c.first_name, c.last_name, c.sex, c.age_in_months, c.age_group,
         c.guardian_name, c.barangay, c.status,
         nr.weight_kg, nr.height_cm, nr.overall_status, nr.record_date AS last_visit
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
       ORDER BY c.first_name ASC`
    );
    return res.status(200).json(children);
  } catch (error) {
    console.error('Get children error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getMothers = async (req, res) => {
  try {
    const [mothers] = await pool.query(
      `SELECT mother_id, first_name, last_name, barangay, contact_number, status, child_id
       FROM mothers
       ORDER BY first_name ASC`
    );

    const [linkedChildren] = await pool.query(
      `SELECT child_id, mother_id, first_name, last_name, age_in_months, age_group, barangay, status
       FROM children
       WHERE mother_id IS NOT NULL
       ORDER BY first_name ASC`
    );

    const mothersWithChildren = mothers.map((mother) => ({
      ...mother,
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