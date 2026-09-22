const pool = require('../config/db');

exports.getAdminStats = async (req, res) => {
  try {
    console.log('HTTP getAdminStats called', { path: req.path, user: req.user && { user_id: req.user.user_id, username: req.user.username, role: req.user.role }, query: req.query });
    const rangeMonths = { '3M': 3, '6M': 6, '1Y': 12 }[req.query.range] || 3;
    const rangeFilter = `record_date >= DATE_SUB(CURDATE(), INTERVAL ${rangeMonths} MONTH)`;

    // helper to verify a column exists in the current DB
    const hasColumn = async (table, column) => {
      const dbName = process.env.DB_DATABASE || process.env.DB_NAME || process.env.MYSQL_DATABASE || 'appscale_db';
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, table, column]
      );
      return Number(cnt) > 0;
    };

    const [[{ totalChildren }]] = await pool.query(`SELECT COUNT(*) AS totalChildren FROM children WHERE status = 'active'`);

    const [[{ totalMothers }]] = await pool.query(`SELECT COUNT(*) AS totalMothers FROM mothers WHERE status = 'active'`);


    const [[{ totalBarangays }]] = await pool.query(`SELECT COUNT(DISTINCT barangay) AS totalBarangays FROM children where status = 'active' `);

    const [[{ totalUsers }]] = await pool.query(`SELECT COUNT(*) AS totalUsers FROM users WHERE role IN ('admin', 'bhw') AND status = 'active' `);

    const [trendRows] = await pool.query(
      `SELECT nr.overall_status, COUNT(*) AS count
       FROM nutrition_records nr
       INNER JOIN (
             SELECT child_id, MAX(record_date) AS latest_date
             FROM nutrition_records
             WHERE ${rangeFilter}
           GROUP BY child_id
           ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
           WHERE ${rangeFilter}
       GROUP BY nr.overall_status`
    );

    const nutritionTrends = {normal: 0, MAM: 0, SAM: 0, overweight: 0, underweight: 0};

    trendRows.forEach(row => {
      if(nutritionTrends.hasOwnProperty(row.overall_status)) {
        nutritionTrends[row.overall_status] = row.count;
      }
    });

    
    // build condition dynamically depending on available columns to avoid SQL errors
    const hasWasting = await hasColumn('nutrition_records', 'wasting_status');
    const conditionParts = ["nr.weight_status IN ('underweight', 'severly_underweight')", "nr.height_status IN ('stunted', 'severly_stunted')"];
    if (hasWasting) conditionParts.push("nr.wasting_status IN ('wasted', 'severly_wasted')");
    const malnutritionWhere = conditionParts.join(' OR ');

    let [malnutritionByBarangayRows] = await pool.query(
      `SELECT c.barangay, COUNT(*) AS cases
      FROM nutrition_records nr
      INNER JOIN (
            SELECT child_id, MAX(record_date) AS latest_date
            FROM nutrition_records
            WHERE ${rangeFilter}
          GROUP BY child_id
      ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
      INNER JOIN children c ON c.child_id = nr.child_id
          WHERE ${rangeFilter}
          AND (${malnutritionWhere})
      GROUP BY c.barangay
      ORDER BY cases DESC`
    );
    let malnutritionOverviewFallback = false;

    if (malnutritionByBarangayRows.length === 0) {
      
      // fallback: same logic but without range filter
      const fallbackCondition = malnutritionWhere;
      [malnutritionByBarangayRows] = await pool.query(
        `SELECT c.barangay, COUNT(*) AS cases
         FROM nutrition_records nr
         INNER JOIN (
           SELECT child_id, MAX(record_date) AS latest_date
           FROM nutrition_records
           GROUP BY child_id
         ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date
         INNER JOIN children c ON c.child_id = nr.child_id
         WHERE ${fallbackCondition}
         GROUP BY c.barangay
         ORDER BY cases DESC`
      );
      malnutritionOverviewFallback = malnutritionByBarangayRows.length > 0;
    }

    const [upcomingActivities] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time, venue, barangay
      FROM schedules
      WHERE status = 'pending' AND schedule_date >= CURDATE()
      ORDER BY schedule_date ASC`
    );

    // dynamically select only existing columns
    const hasWastingCol = await hasColumn('nutrition_records', 'wasting_status');
    const selectCols = ['weight_status', 'height_status'];
    if (hasWastingCol) selectCols.push('wasting_status');
    const [nineCategoryRows] = await pool.query(
      `SELECT ${selectCols.join(', ')}
      FROM nutrition_records nr
      INNER JOIN (
          SELECT child_id, MAX(record_date) AS latest_date
          FROM nutrition_records
          GROUP BY child_id
        ) latest ON nr.child_id = latest.child_id AND nr.record_date = latest.latest_date`
    );

    const nineCategoryTrend = {
      normal: 0,
      underweight: 0,
      severly_underweight: 0,
      stunted: 0,
      wasted: 0,
      overweight: 0,
      severly_stunted: 0,
      severly_wasted: 0,
      obese: 0,
      
    };

    nineCategoryRows.forEach((row) => {
      if (row.weight_status === 'underweight') nineCategoryTrend.underweight++;
      else if (row.weight_status === 'severly_underweight') nineCategoryTrend.severly_underweight++;
      else if (row.weight_status === 'overweight') nineCategoryTrend.overweight++;
      else if (row.weight_status === 'obese') nineCategoryTrend.obese++;

      if (row.height_status === 'stunted') nineCategoryTrend.stunted++;
      else if (row.height_status === 'severly_stunted') nineCategoryTrend.severly_stunted++;

      if (row.wasting_status === 'wasted') nineCategoryTrend.wasted++;
      else if (row.wasting_status === 'severly_wasted') nineCategoryTrend.severly_wasted++;

      if (row.weight_status === 'normal' && row.height_status === 'normal' && row.wasting_status === 'normal') {
        nineCategoryTrend.normal++;
      }
    });

    return res.status(200).json({
      totalChildren,
      totalMothers,
      totalBarangays,
      totalUsers,
      nutritionTrends,
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

    // avoid referencing optional columns directly
    const dbName = process.env.DB_DATABASE || process.env.DB_NAME || process.env.MYSQL_DATABASE || 'appscale_db';
    const [[{ cnt: wastingCnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, 'nutrition_records', 'wasting_status']
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
      "nr.weight_status IN ('underweight','severly_underweight','severly_underweight')",
      "nr.height_status IN ('stunted','severly_stunted')",
    ];
    if (hasWastingCol) conditionParts.push("nr.wasting_status IN ('wasted','severly_wasted')");

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