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
    const notTestChild = "c.status = 'active' AND (c.barangay IS NULL OR LOWER(c.barangay) NOT LIKE '%test%') AND LOWER(c.first_name) NOT LIKE '%test%' AND LOWER(c.last_name) NOT LIKE '%test%'";
    const notTestMother = "status = 'active' AND (barangay IS NULL OR LOWER(barangay) NOT LIKE '%test%') AND LOWER(first_name) NOT LIKE '%test%' AND LOWER(last_name) NOT LIKE '%test%'";

    const [[{ totalChildren }]] = await pool.query(
      `SELECT COUNT(*) AS totalChildren FROM children c WHERE ${notTestChild}`
    );
    const [[{ totalMothers }]] = await pool.query(
      `SELECT COUNT(*) AS totalMothers FROM mothers WHERE ${notTestMother}`
    );
    const [[{ totalBarangays }]] = await pool.query(
      `SELECT COUNT(DISTINCT c.barangay) AS totalBarangays FROM children c WHERE ${notTestChild} AND ${notTestBarangay}`
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
    // Selected strictly by measured date DESC, with record_id DESC as tie-breaker
    const selectCols = ['nr.record_id', 'nr.record_date', 'nr.weight_status', 'nr.height_status', 'nr.overall_status'];
    if (hasWasting) selectCols.push('nr.wasting_status');

    const [nineCategoryRows] = await pool.query(
      `SELECT c.child_id, c.barangay, ${selectCols.join(', ')}
       FROM children c
       LEFT JOIN (
         SELECT nr_sub.* FROM (
           SELECT nr1.*,
                  ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
           FROM nutrition_records nr1
         ) nr_sub WHERE nr_sub.rn = 1
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

    // Retrieve all monitored barangays so barangays with 0 cases are still displayed
    const [allBarangaysRows] = await pool.query(
      `SELECT DISTINCT c.barangay
       FROM children c
       WHERE c.status = 'active' AND ${notTestBarangay}
       ORDER BY c.barangay ASC`
    );
    const barangayCasesMap = {};
    allBarangaysRows.forEach((b) => {
      if (b.barangay) barangayCasesMap[b.barangay] = 0;
    });

    // Classify each child into a single primary nutrition status so the sum exactly matches total active children
    nineCategoryRows.forEach((row) => {
      const category = classifyChildNutrition(row);
      nineCategoryTrend[category] = (nineCategoryTrend[category] || 0) + 1;

      // Malnutrition case if not normal and not no_assessment
      const isMalnutrition = category !== 'normal' && category !== 'no_assessment';
      if (isMalnutrition && row.barangay && barangayCasesMap[row.barangay] !== undefined) {
        barangayCasesMap[row.barangay]++;
      }
    });

    const malnutritionByBarangayRows = Object.entries(barangayCasesMap)
      .map(([barangay, cases]) => ({ barangay, cases }))
      .sort((a, b) => b.cases - a.cases || a.barangay.localeCompare(b.barangay));

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

// Unified nutrition status classifier:
// Priority order: SAM/Severely Underweight > Severely Stunted > Severely Wasted > MAM/Underweight > Stunted > Wasted > Obese > Overweight > Normal
function classifyChildNutrition(row) {
  if (!row || !row.record_id) {
    return 'no_assessment';
  }
  const ws = String(row.weight_status || '').toLowerCase();
  const hs = String(row.height_status || '').toLowerCase();
  const was = String(row.wasting_status || '').toLowerCase();
  const os = String(row.overall_status || '').toLowerCase();

  if (ws.includes('severely') || ws.includes('severly') || os === 'sam') {
    return 'severely_underweight';
  }
  if (hs.includes('severely') || hs.includes('severly')) {
    return 'severely_stunted';
  }
  if (was.includes('severely') || was.includes('severly')) {
    return 'severely_wasted';
  }
  if (ws === 'underweight' || os === 'mam') {
    return 'underweight';
  }
  if (hs === 'stunted') {
    return 'stunted';
  }
  if (was === 'wasted') {
    return 'wasted';
  }
  if (ws === 'obese' || os === 'obese') {
    return 'obese';
  }
  if (ws === 'overweight' || os === 'overweight') {
    return 'overweight';
  }
  return 'normal';
}

exports.classifyChildNutrition = classifyChildNutrition;

// Audit endpoint: list each child with their latest measurement & computed status for side-by-side comparison
exports.getNutritionAudit = async (req, res) => {
  try {
    const notTestChild = "c.status = 'active' AND (c.barangay IS NULL OR LOWER(c.barangay) NOT LIKE '%test%') AND LOWER(c.first_name) NOT LIKE '%test%' AND LOWER(c.last_name) NOT LIKE '%test%'";

    const [[{ cnt: wastingCnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nutrition_records' AND COLUMN_NAME = 'wasting_status'`
    );
    const hasWasting = Number(wastingCnt) > 0;

    const selectCols = ['nr.record_id', 'nr.record_date', 'nr.weight_kg', 'nr.height_cm', 'nr.weight_status', 'nr.height_status', 'nr.overall_status'];
    if (hasWasting) selectCols.push('nr.wasting_status');

    const [rows] = await pool.query(
      `SELECT c.child_id, c.first_name, c.last_name, c.barangay, c.status,
              ${selectCols.join(', ')}
       FROM children c
       LEFT JOIN (
         SELECT nr_sub.* FROM (
           SELECT nr1.*,
                  ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
           FROM nutrition_records nr1
         ) nr_sub WHERE nr_sub.rn = 1
       ) nr ON nr.child_id = c.child_id
       WHERE ${notTestChild}
       ORDER BY c.barangay ASC, c.first_name ASC`
    );

    const childrenAudit = rows.map((r) => {
      const category = classifyChildNutrition(r);
      const isMalnourished = category !== 'normal' && category !== 'no_assessment';
      return {
        child_id: r.child_id,
        full_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        barangay: r.barangay,
        record_id: r.record_id || null,
        record_date: r.record_date || null,
        weight_kg: r.weight_kg != null ? Number(r.weight_kg) : null,
        height_cm: r.height_cm != null ? Number(r.height_cm) : null,
        weight_status: r.weight_status || null,
        height_status: r.height_status || null,
        overall_status: r.overall_status || null,
        wasting_status: r.wasting_status || null,
        computed_category: category,
        is_malnourished: isMalnourished,
      };
    });

    const categorySummary = {};
    const barangaySummary = {};

    childrenAudit.forEach((c) => {
      categorySummary[c.computed_category] = (categorySummary[c.computed_category] || 0) + 1;
      if (!barangaySummary[c.barangay]) {
        barangaySummary[c.barangay] = { total_children: 0, malnutrition_cases: 0 };
      }
      barangaySummary[c.barangay].total_children++;
      if (c.is_malnourished) {
        barangaySummary[c.barangay].malnutrition_cases++;
      }
    });

    return res.status(200).json({
      totalActiveChildren: childrenAudit.length,
      categorySummary,
      barangaySummary,
      children: childrenAudit,
    });
  } catch (error) {
    console.error('Nutrition audit error:', error);
    return res.status(500).json({ message: 'Server error generating nutrition audit' });
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
        SELECT nr_sub.* FROM (
          SELECT nr1.*,
                 ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
          FROM nutrition_records nr1
        ) nr_sub WHERE nr_sub.rn = 1
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