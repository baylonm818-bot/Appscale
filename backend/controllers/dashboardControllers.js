const pool = require('../config/db');

exports.getAdminStats = async (req, res) => {
  try {
    const range = req.query.range || '3M';
    let rangeFilter = '1=1';
    if (range === '3M') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)';
    else if (range === '6M') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)';
    else if (range === '1Y') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';

    // helper to verify a column exists in the current active DB
    const hasColumn = async (table, column) => {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return Number(cnt) > 0;
    };

    const [[{ totalChildren }]] = await pool.query(`SELECT COUNT(*) AS totalChildren FROM children WHERE status = 'active'`);
    const [[{ totalMothers }]] = await pool.query(`SELECT COUNT(*) AS totalMothers FROM mothers WHERE status = 'active'`);
    const [[{ totalBarangays }]] = await pool.query(`SELECT COUNT(DISTINCT barangay) AS totalBarangays FROM children WHERE status = 'active' AND barangay IS NOT NULL`);
    const [[{ totalUsers }]] = await pool.query(`SELECT COUNT(*) AS totalUsers FROM users WHERE role IN ('bhw', 'bns') AND status = 'active' AND deleted_at IS NULL`);

    // Check if optional columns exist
    const hasWasting = await hasColumn('nutrition_records', 'wasting_status');

    // Conditions identifying malnutrition / at-risk
    const conditionParts = [
      "nr.weight_status IN ('underweight', 'severely_underweight', 'severly_underweight')",
      "nr.height_status IN ('stunted', 'severely_stunted', 'severly_stunted')",
      "nr.overall_status IN ('MAM', 'SAM', 'underweight', 'severely_underweight')"
    ];
    if (hasWasting) conditionParts.push("nr.wasting_status IN ('wasted', 'severely_wasted', 'severly_wasted')");
    const malnutritionWhere = conditionParts.join(' OR ');

    // Malnutrition cases grouped by barangay
    let [malnutritionByBarangayRows] = await pool.query(
      `SELECT c.barangay, COUNT(DISTINCT c.child_id) AS cases
       FROM nutrition_records nr
       INNER JOIN (
         SELECT child_id, MAX(record_date) AS latest_date
         FROM nutrition_records
         GROUP BY child_id
       ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
       INNER JOIN children c ON c.child_id = nr.child_id
       WHERE c.status = 'active' AND ${rangeFilter} AND (${malnutritionWhere})
       GROUP BY c.barangay
       ORDER BY cases DESC`
    );

    let malnutritionOverviewFallback = false;
    if (malnutritionByBarangayRows.length === 0) {
      // Fallback: search without range filter if no recent records match
      [malnutritionByBarangayRows] = await pool.query(
        `SELECT c.barangay, COUNT(DISTINCT c.child_id) AS cases
         FROM nutrition_records nr
         INNER JOIN (
           SELECT child_id, MAX(record_date) AS latest_date
           FROM nutrition_records
           GROUP BY child_id
         ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
         INNER JOIN children c ON c.child_id = nr.child_id
         WHERE c.status = 'active' AND (${malnutritionWhere})
         GROUP BY c.barangay
         ORDER BY cases DESC`
      );
      malnutritionOverviewFallback = malnutritionByBarangayRows.length > 0;
    }

    // Upcoming pending activities
    const [upcomingActivities] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue, barangay, target_role, facilitator
       FROM schedules
       WHERE status = 'pending' AND schedule_date >= CURDATE()
       ORDER BY schedule_date ASC
       LIMIT 5`
    );

    // Dynamic selection of latest nutrition records
    const selectCols = ['nr.weight_status', 'nr.height_status', 'nr.overall_status'];
    if (hasWasting) selectCols.push('nr.wasting_status');

    const [nineCategoryRows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM nutrition_records nr
       INNER JOIN (
         SELECT child_id, MAX(record_date) AS latest_date
         FROM nutrition_records
         GROUP BY child_id
       ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
       INNER JOIN children c ON c.child_id = nr.child_id
       WHERE c.status = 'active'`
    );

    const nineCategoryTrend = {
      normal: 0,
      underweight: 0,
      severely_underweight: 0,
      stunted: 0,
      severely_stunted: 0,
      overweight: 0,
      obese: 0,
      wasted: 0,
      severely_wasted: 0,
    };

    nineCategoryRows.forEach((row) => {
      const ws = String(row.weight_status || '').toLowerCase();
      const hs = String(row.height_status || '').toLowerCase();
      const was = String(row.wasting_status || '').toLowerCase();
      const os = String(row.overall_status || '').toLowerCase();

      let isNormal = true;

      if (ws === 'underweight') { nineCategoryTrend.underweight++; isNormal = false; }
      else if (ws === 'severely_underweight' || ws === 'severly_underweight') { nineCategoryTrend.severely_underweight++; isNormal = false; }
      else if (ws === 'overweight') { nineCategoryTrend.overweight++; isNormal = false; }
      else if (ws === 'obese') { nineCategoryTrend.obese++; isNormal = false; }

      if (hs === 'stunted') { nineCategoryTrend.stunted++; isNormal = false; }
      else if (hs === 'severely_stunted' || hs === 'severly_stunted') { nineCategoryTrend.severely_stunted++; isNormal = false; }

      if (was === 'wasted') { nineCategoryTrend.wasted++; isNormal = false; }
      else if (was === 'severely_wasted' || was === 'severly_wasted') { nineCategoryTrend.severely_wasted++; isNormal = false; }

      if (isNormal || os === 'normal') {
        nineCategoryTrend.normal++;
      }
    });

    return res.status(200).json({
      totalChildren: totalChildren || 0,
      totalMothers: totalMothers || 0,
      totalBarangays: totalBarangays || 0,
      totalUsers: totalUsers || 0,
      nineCategoryTrend,
      malnutritionByBarangay: malnutritionByBarangayRows,
      malnutritionOverviewFallback,
      upcomingActivities,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error && (error.stack || error));
    return res.status(500).json({ message: 'Server error. Please try again later' });
  }
};

// Admin: list need-attention children across municipality or filtered by barangay
exports.getAdminNeedAttention = async (req, res) => {
  try {
    const { barangay } = req.query;
    const params = [];
    let where = "c.status = 'active'";
    if (barangay) {
      where += ' AND c.barangay = ?';
      params.push(barangay);
    }

    const [[{ cnt: wastingCnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nutrition_records' AND COLUMN_NAME = 'wasting_status'`
    );
    const hasWastingCol = Number(wastingCnt) > 0;

    const selectCols = [
      'c.child_id', 'c.first_name', 'c.last_name', 'c.sex', 'c.age_in_months',
      'c.guardian_name', 'c.guardian_contact',
      'nr.weight_kg', 'nr.height_cm', 'nr.weight_status', 'nr.height_status',
      'nr.overall_status', 'nr.record_date AS last_visit', 'c.barangay'
    ];
    if (hasWastingCol) selectCols.splice(11, 0, 'nr.wasting_status');

    const conditionParts = [
      "nr.overall_status IN ('MAM','SAM')",
      "nr.weight_status IN ('underweight','severely_underweight','severly_underweight')",
      "nr.height_status IN ('stunted','severely_stunted','severly_stunted')",
    ];
    if (hasWastingCol) conditionParts.push("nr.wasting_status IN ('wasted','severely_wasted','severly_wasted')");

    const sql = `SELECT ${selectCols.join(', ')}
      FROM children c
      INNER JOIN (
        SELECT nr1.*
        FROM nutrition_records nr1
        INNER JOIN (
          SELECT child_id, MAX(record_date) AS latest_date
          FROM nutrition_records
          GROUP BY child_id
        ) latest ON nr1.child_id = latest.child_id AND nr1.record_date = latest.latest_date
      ) nr ON nr.child_id = c.child_id
      WHERE ${where}
        AND (${conditionParts.join(' OR ')})
      ORDER BY FIELD(nr.overall_status,'SAM','MAM') ASC, nr.record_date ASC`;

    const [rows] = await pool.query(sql, params);

    return res.status(200).json(rows);
  } catch (error) {
    console.error('Admin need-attention error:', error && (error.stack || error));
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};