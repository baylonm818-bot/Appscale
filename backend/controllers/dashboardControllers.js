const pool = require('../config/db');

exports.getAdminStats = async (req, res) => {
  try {
    const range = req.query.range || '3M';
    let rangeFilter = '1=1';
    if (range === '3M') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)';
    else if (range === '6M') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)';
    else if (range === '1Y') rangeFilter = 'nr.record_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';

    // Helper to verify a column exists in the current active DB
    const hasColumn = async (table, column) => {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return Number(cnt) > 0;
    };

    // Filters to exclude test data
    const notTestBarangay = "c.barangay IS NOT NULL AND TRIM(c.barangay) <> '' AND LOWER(c.barangay) NOT LIKE '%test%'";
    const notTestChild = "status = 'active' AND (barangay IS NULL OR LOWER(barangay) NOT LIKE '%test%') AND LOWER(first_name) NOT LIKE '%test%' AND LOWER(last_name) NOT LIKE '%test%'";
    const notTestMother = "status = 'active' AND (barangay IS NULL OR LOWER(barangay) NOT LIKE '%test%') AND LOWER(first_name) NOT LIKE '%test%' AND LOWER(last_name) NOT LIKE '%test%'";

    const [[{ totalChildren }]] = await pool.query(
      `SELECT COUNT(*) AS totalChildren FROM children WHERE ${notTestChild}`
    );
    const [[{ totalMothers }]] = await pool.query(
      `SELECT COUNT(*) AS totalMothers FROM mothers WHERE ${notTestMother}`
    );
    const [[{ totalBarangays }]] = await pool.query(
      `SELECT COUNT(DISTINCT barangay) AS totalBarangays FROM children c WHERE status = 'active' AND ${notTestBarangay}`
    );

    // Compute user aggregates using the same query definition as User Management
    const [[userStats]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN role IN ('bhw','bns') THEN 1 ELSE 0 END), 0) AS totalUsers,
         COALESCE(SUM(CASE WHEN role = 'bns' THEN 1 ELSE 0 END), 0) AS totalBNS,
         COALESCE(SUM(CASE WHEN role = 'bhw' THEN 1 ELSE 0 END), 0) AS totalBHW
       FROM users
       WHERE deleted_at IS NULL AND role IN ('bhw','bns')`
    );
    const totalUsers = userStats.totalUsers || 0;
    const totalBNS = userStats.totalBNS || 0;
    const totalBHW = userStats.totalBHW || 0;

    // Check if optional columns exist
    const hasWasting = await hasColumn('nutrition_records', 'wasting_status');

    // Conditions identifying malnutrition / at-risk (consistent with Nutrition Breakdown categories)
    const conditionParts = [
      "nr.weight_status IN ('underweight', 'severely_underweight', 'severly_underweight', 'overweight', 'obese')",
      "nr.height_status IN ('stunted', 'severely_stunted', 'severly_stunted')",
      "nr.overall_status IN ('MAM', 'SAM', 'underweight', 'severely_underweight', 'overweight', 'obese')",
    ];
    if (hasWasting) conditionParts.push("nr.wasting_status IN ('wasted', 'severely_wasted', 'severly_wasted')");
    const malnutritionWhere = conditionParts.join(' OR ');

    // Malnutrition cases by barangay: MUST show ALL monitored barangays (with 0 cases if none)
    const [malnutritionByBarangayRows] = await pool.query(
      `SELECT b.barangay, COALESCE(m.cases, 0) AS cases
       FROM (
         SELECT DISTINCT c.barangay
         FROM children c
         WHERE status = 'active' AND ${notTestBarangay}
       ) b
       LEFT JOIN (
         SELECT c.barangay, COUNT(DISTINCT c.child_id) AS cases
         FROM children c
         INNER JOIN (
           SELECT child_id, MAX(record_date) AS latest_date
           FROM nutrition_records
           GROUP BY child_id
         ) latest ON c.child_id = latest.child_id
         INNER JOIN nutrition_records nr ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
         WHERE c.status = 'active'
           AND ${notTestBarangay}
           AND ${rangeFilter}
           AND (${malnutritionWhere})
         GROUP BY c.barangay
       ) m ON m.barangay = b.barangay
       ORDER BY cases DESC, b.barangay ASC`
    );

    // Upcoming pending activities (excluding test entries)
    const [upcomingActivities] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue, barangay, target_role, facilitator
       FROM schedules
       WHERE status = 'pending'
         AND schedule_date >= CURDATE()
         AND LOWER(TRIM(title)) NOT IN ('new', 'in action', 'test', 'h')
         AND LOWER(title) NOT LIKE '%test%'
         AND (barangay IS NULL OR LOWER(barangay) NOT LIKE '%test%')
       ORDER BY schedule_date ASC
       LIMIT 5`
    );

    // Dynamic selection of latest nutrition records for ALL active children (LEFT JOIN to catch unassessed children)
    const selectCols = ['nr.record_id', 'nr.weight_status', 'nr.height_status', 'nr.overall_status'];
    if (hasWasting) selectCols.push('nr.wasting_status');

    const [nineCategoryRows] = await pool.query(
      `SELECT c.child_id, ${selectCols.join(', ')}
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
       WHERE ${notTestChild}`
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
      no_assessment: 0,
    };

    // Classify each child into a single primary nutrition status so the sum exactly matches total active children
    nineCategoryRows.forEach((row) => {
      if (!row.record_id) {
        nineCategoryTrend.no_assessment++;
        return;
      }
      const ws = String(row.weight_status || '').toLowerCase();
      const hs = String(row.height_status || '').toLowerCase();
      const was = String(row.wasting_status || '').toLowerCase();
      const os = String(row.overall_status || '').toLowerCase();

      if (ws.includes('severely') || ws.includes('severly') || os === 'sam') {
        nineCategoryTrend.severely_underweight++;
      } else if (hs.includes('severely') || hs.includes('severly')) {
        nineCategoryTrend.severely_stunted++;
      } else if (was.includes('severely') || was.includes('severly')) {
        nineCategoryTrend.severely_wasted++;
      } else if (ws === 'underweight' || os === 'mam') {
        nineCategoryTrend.underweight++;
      } else if (hs === 'stunted') {
        nineCategoryTrend.stunted++;
      } else if (was === 'wasted') {
        nineCategoryTrend.wasted++;
      } else if (ws === 'obese' || os === 'obese') {
        nineCategoryTrend.obese++;
      } else if (ws === 'overweight' || os === 'overweight') {
        nineCategoryTrend.overweight++;
      } else {
        nineCategoryTrend.normal++;
      }
    });

    return res.status(200).json({
      totalChildren: totalChildren || 0,
      totalMothers: totalMothers || 0,
      totalBarangays: totalBarangays || 0,
      totalUsers: totalUsers || 0,
      totalBNS,
      totalBHW,
      nineCategoryTrend,
      malnutritionByBarangay: malnutritionByBarangayRows,
      malnutritionOverviewFallback: false,
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