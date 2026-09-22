const pool = require('../config/db');

async function getScopedBnsFilter(req, tableName, alias) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'bns') {
    return { clause: '', params: [] };
  }

  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_DATABASE || process.env.DB_NAME || 'appscale_db', tableName, 'encoded_by']
  );

  if (Number(cnt) === 0) {
    return { clause: '', params: [] };
  }

  return {
    clause: `AND ${alias}.encoded_by = ?`,
    params: [req.user.user_id],
  };
}

exports.getBhwStats = async (req, res) => {
  const { barangay } = req.query;

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const { clause: childScopeClause, params: childScopeParams } = await getScopedBnsFilter(req, 'children', 'c');
    const [[childStats]] = await pool.query(
      `SELECT COUNT(*) AS totalChildren FROM children c WHERE c.barangay = ? AND c.status = 'active' ${childScopeClause}`,
      [barangay, ...childScopeParams]
    );

    const { clause: motherScopeClause, params: motherScopeParams } = await getScopedBnsFilter(req, 'mothers', 'm');
    const [[motherStats]] = await pool.query(
      `SELECT COUNT(*) AS totalMothers FROM mothers m WHERE m.barangay = ? AND m.status = 'active' ${motherScopeClause}`,
      [barangay, ...motherScopeParams]
    );

    // Latest nutrition record per child in this barangay
    // Check if wasting_status column exists to avoid ER_BAD_FIELD_ERROR
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_DATABASE || process.env.DB_NAME || 'appscale_db', 'nutrition_records', 'wasting_status']
    );
    const hasWasting = Number(cnt) > 0;

    const selectCols = ['nr.weight_status', 'nr.height_status', 'nr.overall_status'];
    if (hasWasting) selectCols.splice(2, 0, 'nr.wasting_status');

    const [latestRecords] = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM nutrition_records nr
       INNER JOIN (
         SELECT child_id, MAX(record_date) AS latest_date
         FROM nutrition_records
         GROUP BY child_id
       ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
       INNER JOIN children c ON c.child_id = nr.child_id
       WHERE c.barangay = ? ${childScopeClause}`,
      [barangay, ...childScopeParams]
    );

    let normal = 0, stunted = 0, wasted = 0, underweight = 0, atRiskChildren = 0;
    latestRecords.forEach((r) => {
      if (r.weight_status === 'underweight' || r.weight_status === 'severely_underweight') underweight++;
      if (r.height_status === 'stunted' || r.height_status === 'severely_stunted') stunted++;
      if (hasWasting && (r.wasting_status === 'wasted' || r.wasting_status === 'severely_wasted')) wasted++;
      if (r.overall_status === 'normal') normal++;
      if (r.overall_status === 'MAM' || r.overall_status === 'SAM') atRiskChildren++;
    });

    const [[atRiskMothersRow]] = await pool.query(
      `SELECT COUNT(*) AS atRiskMothers FROM mothers m WHERE m.barangay = ? AND m.status = 'active' AND m.weight_kg IS NOT NULL AND m.weight_kg < 45 ${motherScopeClause}`,
      [barangay, ...motherScopeParams]
    );

    const [monthlyRows] = await pool.query(
      `SELECT DATE_FORMAT(nr.record_date, '%Y-%m') AS month_key,
              COUNT(DISTINCT nr.child_id) AS monitored,
              COUNT(DISTINCT CASE WHEN nr.overall_status IN ('MAM', 'SAM') THEN nr.child_id END) AS at_risk
       FROM nutrition_records nr
       INNER JOIN children c ON c.child_id = nr.child_id
       WHERE c.barangay = ?
         AND nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
         ${childScopeClause}
       GROUP BY DATE_FORMAT(nr.record_date, '%Y-%m')
       ORDER BY month_key ASC`,
      [barangay, ...childScopeParams]
    );

    const monthlyMonitoring = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = monthlyRows.find((item) => item.month_key === monthKey);
      return {
        month: date.toLocaleString('en-US', { month: 'short' }),
        monitored: Number(row?.monitored || 0),
        atRisk: Number(row?.at_risk || 0),
      };
    });

    return res.status(200).json({
      totalChildren: childStats.totalChildren || 0,
      totalMothers: motherStats.totalMothers || 0,
      atRiskChildren,
      atRiskMothers: atRiskMothersRow.atRiskMothers || 0,
      normal,
      stunted,
      wasted,
      underweight,
      monthlyMonitoring,
    });
  } catch (error) {
    console.error('Get BHW stats error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};