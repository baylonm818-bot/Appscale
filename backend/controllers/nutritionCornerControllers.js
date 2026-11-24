const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

const ALL_GASAN_BARANGAYS = [
  'Antipolo',
  'B. Ibaba',
  'B. Ilaya',
  'Bacong-Bacong',
  'Bahi',
  'Bangbang',
  'Banot',
  'Banuyo',
  'Bognuyan',
  'Brgy. Dos',
  'Brgy. Tres',
  'Brgy. Uno',
  'Cabugao',
  'Dawis',
  'Dili',
  'Libtangin',
  'Mahunig',
  'Mangiliol',
  'Masiga',
  'Mat. Gasan',
  'Pangi',
  'Pinggan',
  'Tabionan',
  'Tapuyan',
  'Tiguion',
];

const notTestChild = "c.status = 'active' AND (c.barangay IS NULL OR LOWER(c.barangay) NOT LIKE '%test%') AND LOWER(c.first_name) NOT LIKE '%test%' AND LOWER(c.last_name) NOT LIKE '%test%'";

/**
 * 1. GET /api/nutrition-corner/consolidation
 * Consolidation of Nutritional Status (WFA, WFH, HFA, School Children)
 * Query: ?year=2026&barangay=All
 */
exports.getConsolidation = async (req, res) => {
  try {
    const selectedYear = parseInt(req.query.year || new Date().getFullYear(), 10);
    const requestedBarangay = (req.query.barangay || 'All').trim();

    // BHW is restricted to their assigned barangay
    let barangay = requestedBarangay;
    if (req.user && req.user.role === 'bhw' && req.user.barangay) {
      barangay = req.user.barangay;
    }

    const years = [selectedYear - 2, selectedYear - 1, selectedYear];

    // Build barangay filter
    let bgyCondition = '1=1';
    let bgyParams = [];
    if (barangay && barangay.toLowerCase() !== 'all' && barangay.toLowerCase() !== 'all barangays') {
      bgyCondition = 'c.barangay = ?';
      bgyParams = [barangay];
    }

    // Helper to compute breakdown for an indicator in a given year
    const computeIndicatorYear = async (yr) => {
      // Total population in this year
      const [[{ total_population }]] = await pool.query(
        `SELECT COUNT(*) AS total_population
         FROM children c
         WHERE ${notTestChild} AND ${bgyCondition}
           AND YEAR(c.created_at) <= ?`,
        [...bgyParams, yr]
      );

      // Latest record per child in this year
      const [records] = await pool.query(
        `SELECT c.child_id, nr.weight_status, nr.height_status, nr.overall_status, nr.bmi_status
         FROM children c
         JOIN (
           SELECT nr1.*,
                  ROW_NUMBER() OVER (PARTITION BY nr1.child_id ORDER BY nr1.record_date DESC, nr1.record_id DESC) AS rn
           FROM nutrition_records nr1
           WHERE YEAR(nr1.record_date) = ?
         ) nr ON nr.child_id = c.child_id AND nr.rn = 1
         WHERE ${notTestChild} AND ${bgyCondition}`,
        [yr, ...bgyParams]
      );

      const total_weighed = records.length;
      const popCount = Number(total_population) || (total_weighed > 0 ? total_weighed : 0);
      const weighed_pct = popCount > 0 ? ((total_weighed / popCount) * 100).toFixed(1) : '0.0';

      // 1) WFA
      let wfa_normal = 0;
      let wfa_underweight = 0;
      let wfa_severely_underweight = 0;
      let wfa_overweight = 0;

      // 2) WFH
      let wfh_normal = 0;
      let wfh_wasted = 0;
      let wfh_severely_wasted = 0;
      let wfh_overweight = 0;
      let wfh_obese = 0;

      // 3) HFA
      let hfa_normal = 0;
      let hfa_stunted = 0;
      let hfa_severely_stunted = 0;
      let hfa_tall = 0;

      for (const r of records) {
        // WFA
        const ws = String(r.weight_status || '').toLowerCase();
        if (ws.includes('severely') || ws.includes('severly') || ws === 'suw') {
          wfa_severely_underweight++;
        } else if (ws === 'underweight' || ws === 'uw') {
          wfa_underweight++;
        } else if (ws === 'overweight' || ws === 'obese' || ws === 'ow' || ws === 'ob') {
          wfa_overweight++;
        } else {
          wfa_normal++;
        }

        // WFH
        const os = String(r.overall_status || '').toLowerCase();
        const bmi = String(r.bmi_status || '').toLowerCase();
        if (os === 'sam' || os.includes('severe') || os.includes('severely_wasted')) {
          wfh_severely_wasted++;
        } else if (os === 'mam' || os === 'wasted') {
          wfh_wasted++;
        } else if (os === 'obese' || bmi === 'obese') {
          wfh_obese++;
        } else if (os === 'overweight' || bmi === 'overweight') {
          wfh_overweight++;
        } else {
          wfh_normal++;
        }

        // HFA
        const hs = String(r.height_status || '').toLowerCase();
        if (hs.includes('severely') || hs.includes('severly') || hs === 'sst') {
          hfa_severely_stunted++;
        } else if (hs === 'stunted' || hs === 'st') {
          hfa_stunted++;
        } else if (hs === 'tall') {
          hfa_tall++;
        } else {
          hfa_normal++;
        }
      }

      const pctOf = (cnt) => (total_weighed > 0 ? ((cnt / total_weighed) * 100).toFixed(1) : '0.0');

      return {
        year: yr,
        total_population: popCount,
        total_weighed,
        weighed_pct,
        wfa: {
          normal: { count: wfa_normal, pct: pctOf(wfa_normal) },
          underweight: { count: wfa_underweight, pct: pctOf(wfa_underweight) },
          severely_underweight: { count: wfa_severely_underweight, pct: pctOf(wfa_severely_underweight) },
          overweight: { count: wfa_overweight, pct: pctOf(wfa_overweight) },
        },
        wfh: {
          normal: { count: wfh_normal, pct: pctOf(wfh_normal) },
          wasted: { count: wfh_wasted, pct: pctOf(wfh_wasted) },
          severely_wasted: { count: wfh_severely_wasted, pct: pctOf(wfh_severely_wasted) },
          overweight: { count: wfh_overweight, pct: pctOf(wfh_overweight) },
          obese: { count: wfh_obese, pct: pctOf(wfh_obese) },
        },
        hfa: {
          normal: { count: hfa_normal, pct: pctOf(hfa_normal) },
          stunted: { count: hfa_stunted, pct: pctOf(hfa_stunted) },
          severely_stunted: { count: hfa_severely_stunted, pct: pctOf(hfa_severely_stunted) },
          tall: { count: hfa_tall, pct: pctOf(hfa_tall) },
        },
      };
    };

    const consolidationData = await Promise.all(years.map((y) => computeIndicatorYear(y)));

    // Fetch School Children data
    const [schoolRows] = await pool.query(
      `SELECT school_year, barangay, total_enrolled, total_measured, normal, wasted, severely_wasted, overweight, obese
       FROM nutrition_school_data
       WHERE barangay = ? OR barangay = 'All Barangays'
       ORDER BY school_year ASC`,
      [barangay]
    );

    // Fallback if specific barangay had no row, return 'All Barangays' rows
    let schoolData = schoolRows.filter((r) => r.barangay === barangay);
    if (schoolData.length === 0) {
      schoolData = schoolRows.filter((r) => r.barangay === 'All Barangays');
    }

    return res.status(200).json({
      selectedYear,
      barangay,
      years,
      consolidation: consolidationData,
      schoolData,
    });
  } catch (error) {
    console.error('getConsolidation error:', error);
    return res.status(500).json({ message: 'Server error retrieving consolidation.' });
  }
};

/**
 * 2. GET /api/nutrition-corner/monthly-monitoring
 * 25 Barangays x 12 Months Weight Monitoring Matrix
 * Query: ?year=2026
 */
exports.getMonthlyMonitoring = async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const search = (req.query.search || '').trim().toLowerCase();

    // 1) Get target active children per barangay
    const [targetRows] = await pool.query(`
      SELECT c.barangay, COUNT(*) AS target_count
      FROM children c
      WHERE ${notTestChild} AND c.barangay IS NOT NULL AND TRIM(c.barangay) <> ''
      GROUP BY c.barangay
    `);
    const targetMap = {};
    for (const row of targetRows) {
      targetMap[row.barangay] = Number(row.target_count);
    }

    // 2) Get weighed counts per barangay and month for the given year
    const [weighedRows] = await pool.query(`
      SELECT c.barangay, MONTH(nr.record_date) AS \`month\`, COUNT(DISTINCT c.child_id) AS weighed_count
      FROM children c
      JOIN nutrition_records nr ON nr.child_id = c.child_id
      WHERE ${notTestChild}
        AND YEAR(nr.record_date) = ?
        AND c.barangay IS NOT NULL AND TRIM(c.barangay) <> ''
      GROUP BY c.barangay, MONTH(nr.record_date)
    `, [year]);

    const weighedMap = {};
    for (const row of weighedRows) {
      if (!weighedMap[row.barangay]) weighedMap[row.barangay] = {};
      weighedMap[row.barangay][row.month] = Number(row.weighed_count);
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Build 25 rows
    const matrix = ALL_GASAN_BARANGAYS.map((bName) => {
      const target = targetMap[bName] || 0;
      const bWeighed = weighedMap[bName] || {};

      let annualWeighedSum = 0;
      let activeMonthsCount = 0;

      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const weighed = bWeighed[m] || 0;
        annualWeighedSum += weighed;

        const isFuture = year > currentYear || (year === currentYear && m > currentMonth);
        const pct = target > 0 ? Math.round((weighed / target) * 100) : 0;

        let status = 'gray';
        if (target > 0 && !isFuture) {
          activeMonthsCount++;
          if (pct >= 90) status = 'green';
          else if (pct >= 60) status = 'orange';
          else status = 'red';
        } else if (weighed > 0) {
          if (pct >= 90) status = 'green';
          else if (pct >= 60) status = 'orange';
          else status = 'red';
        }

        return {
          month: m,
          weighed,
          target,
          percentage: pct,
          status,
          isFuture,
        };
      });

      const avgWeighed = activeMonthsCount > 0 ? Math.round(annualWeighedSum / activeMonthsCount) : 0;
      const totalPct = target > 0 ? Math.round((avgWeighed / target) * 100) : 0;

      return {
        barangay: bName,
        target,
        months,
        rowTotal: {
          totalWeighed: annualWeighedSum,
          avgWeighed,
          percentage: totalPct,
          status: target === 0 ? 'gray' : (totalPct >= 90 ? 'green' : (totalPct >= 60 ? 'orange' : 'red')),
        },
      };
    });

    // Column totals across all 25 barangays
    const columnTotals = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      let totalWeighed = 0;
      let totalTarget = 0;
      for (const row of matrix) {
        totalWeighed += row.months[i].weighed;
        totalTarget += row.months[i].target;
      }
      const pct = totalTarget > 0 ? Math.round((totalWeighed / totalTarget) * 100) : 0;
      const isFuture = year > currentYear || (year === currentYear && m > currentMonth);
      let status = 'gray';
      if (totalTarget > 0 && !isFuture) {
        if (pct >= 90) status = 'green';
        else if (pct >= 60) status = 'orange';
        else status = 'red';
      }
      return {
        month: m,
        totalWeighed,
        totalTarget,
        percentage: pct,
        status,
        isFuture,
      };
    });

    // Filter by search if provided
    const filteredMatrix = search
      ? matrix.filter((row) => row.barangay.toLowerCase().includes(search))
      : matrix;

    return res.status(200).json({
      year,
      matrix: filteredMatrix,
      columnTotals,
      barangayCount: ALL_GASAN_BARANGAYS.length,
    });
  } catch (error) {
    console.error('getMonthlyMonitoring error:', error);
    return res.status(500).json({ message: 'Server error retrieving monthly monitoring matrix.' });
  }
};

/**
 * 3. GET /api/nutrition-corner/unweighed-children
 * Returns unweighed children for a given barangay, year, and month
 * Query: ?barangay=Antipolo&year=2026&month=11
 */
exports.getUnweighedChildren = async (req, res) => {
  try {
    const barangay = (req.query.barangay || '').trim();
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const month = parseInt(req.query.month || new Date().getMonth() + 1, 10);

    if (!barangay) {
      return res.status(400).json({ message: 'Barangay is required.' });
    }

    // Children in barangay who DO NOT have a nutrition_records entry in this year/month
    const [unweighed] = await pool.query(
      `SELECT c.child_id, c.first_name, c.middle_initial, c.last_name, c.sex, c.birth_date, c.barangay, c.purok,
              c.guardian_name, c.guardian_contact,
              TIMESTAMPDIFF(MONTH, c.birth_date, CURDATE()) AS age_in_months
       FROM children c
       WHERE ${notTestChild}
         AND c.barangay = ?
         AND c.child_id NOT IN (
           SELECT nr.child_id
           FROM nutrition_records nr
           WHERE YEAR(nr.record_date) = ? AND MONTH(nr.record_date) = ?
         )
       ORDER BY c.purok ASC, c.last_name ASC, c.first_name ASC`,
      [barangay, year, month]
    );

    const formatted = unweighed.map((c) => ({
      child_id: c.child_id,
      full_name: `${c.first_name || ''} ${c.middle_initial ? c.middle_initial + '.' : ''} ${c.last_name || ''}`.replace(/\s+/g, ' ').trim(),
      sex: c.sex || 'N/A',
      birth_date: c.birth_date,
      age_in_months: c.age_in_months,
      barangay: c.barangay,
      purok: c.purok || 'Purok 1',
      guardian: c.guardian_name || 'N/A',
      contact: c.guardian_contact || 'N/A',
    }));

    return res.status(200).json({
      barangay,
      year,
      month,
      unweighed_count: formatted.length,
      children: formatted,
    });
  } catch (error) {
    console.error('getUnweighedChildren error:', error);
    return res.status(500).json({ message: 'Server error retrieving unweighed children.' });
  }
};

/**
 * 4. GET /api/nutrition-corner/programs
 * Query programs with live coverage metrics (Feeding, Vitamin A, Deworming)
 */
exports.getPrograms = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const requestedBarangay = (req.query.barangay || '').trim();

    let bgyCondition = '1=1';
    let bgyParams = [];
    if (requestedBarangay && requestedBarangay.toLowerCase() !== 'all') {
      bgyCondition = 'c.barangay = ?';
      bgyParams = [requestedBarangay];
    }

    // 1) Total target population
    const [[{ total_active_children }]] = await pool.query(
      `SELECT COUNT(*) AS total_active_children FROM children c WHERE ${notTestChild} AND ${bgyCondition}`,
      bgyParams
    );
    const totalTarget = Number(total_active_children) || 0;

    // 2) Feeding coverage: active enrolled in program_enrollments
    let feedingCondition = "status = 'enrolled'";
    let feedingParams = [];
    if (requestedBarangay && requestedBarangay.toLowerCase() !== 'all') {
      feedingCondition += ' AND barangay = ?';
      feedingParams.push(requestedBarangay);
    }
    const [[{ feeding_enrolled }]] = await pool.query(
      `SELECT COUNT(DISTINCT child_id) AS feeding_enrolled FROM program_enrollments WHERE ${feedingCondition}`,
      feedingParams
    );

    // Feeding attendance count in current year
    const [[{ feeding_attendance_count }]] = await pool.query(`
      SELECT COUNT(*) AS feeding_attendance_count
      FROM feeding_attendance fa
      JOIN children c ON c.child_id = fa.child_id
      WHERE ${notTestChild} AND ${bgyCondition} AND YEAR(fa.attendance_date) = ?
    `, [...bgyParams, currentYear]);

    // 3) Vitamin A coverage in current year
    const [[{ vitamin_a_count }]] = await pool.query(`
      SELECT COUNT(DISTINCT cs.child_id) AS vitamin_a_count
      FROM child_services cs
      JOIN children c ON c.child_id = cs.child_id
      WHERE ${notTestChild} AND ${bgyCondition}
        AND LOWER(cs.service_type) LIKE '%vitamin%'
        AND YEAR(cs.service_date) = ?
    `, [...bgyParams, currentYear]);

    // 4) Deworming coverage in current year
    const [[{ deworming_count }]] = await pool.query(`
      SELECT COUNT(DISTINCT cs.child_id) AS deworming_count
      FROM child_services cs
      JOIN children c ON c.child_id = cs.child_id
      WHERE ${notTestChild} AND ${bgyCondition}
        AND LOWER(cs.service_type) LIKE '%deworm%'
        AND YEAR(cs.service_date) = ?
    `, [...bgyParams, currentYear]);

    // Fetch programs from table
    const [programs] = await pool.query(`
      SELECT id, section, title, description, coverage_metric, sort_order, is_active
      FROM nutrition_corner_programs
      WHERE is_active = 1
      ORDER BY section ASC, sort_order ASC, id ASC
    `);

    const programsWithMetrics = programs.map((p) => {
      let metricData = null;
      if (p.coverage_metric === 'feeding') {
        const enrolled = Number(feeding_enrolled) || 0;
        const pct = totalTarget > 0 ? Math.round((enrolled / totalTarget) * 100) : 0;
        metricData = {
          label: 'Supplementary Feeding',
          enrolled,
          target: totalTarget,
          percentage: pct,
          attendanceRecords: Number(feeding_attendance_count) || 0,
        };
      } else if (p.coverage_metric === 'vitamin_a') {
        const covered = Number(vitamin_a_count) || 0;
        const pct = totalTarget > 0 ? Math.round((covered / totalTarget) * 100) : 0;
        metricData = {
          label: 'Vitamin A Coverage',
          covered,
          target: totalTarget,
          percentage: pct,
        };
      } else if (p.coverage_metric === 'deworming') {
        const covered = Number(deworming_count) || 0;
        const pct = totalTarget > 0 ? Math.round((covered / totalTarget) * 100) : 0;
        metricData = {
          label: 'Deworming Coverage',
          covered,
          target: totalTarget,
          percentage: pct,
        };
      }

      return {
        ...p,
        coverage: metricData,
      };
    });

    return res.status(200).json({
      programs: programsWithMetrics,
      summary: {
        totalTarget,
        feedingEnrolled: Number(feeding_enrolled) || 0,
        vitaminACount: Number(vitamin_a_count) || 0,
        dewormingCount: Number(deworming_count) || 0,
      },
    });
  } catch (error) {
    console.error('getPrograms error:', error);
    return res.status(500).json({ message: 'Server error retrieving programs.' });
  }
};

/**
 * 5. POST /api/nutrition-corner/programs
 * Admin: Add new program
 */
exports.addProgram = async (req, res) => {
  try {
    const { section, title, description, coverage_metric, sort_order } = req.body;
    if (!section || !title) {
      return res.status(400).json({ message: 'Section and title are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO nutrition_corner_programs (section, title, description, coverage_metric, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [section, title, description || '', coverage_metric || null, sort_order || 0]
    );

    if (req.user) {
      await logAction(req.user.user_id, 'CREATE_NUTRITION_PROGRAM', { id: result.insertId, title });
    }

    return res.status(201).json({ message: 'Program created successfully', id: result.insertId });
  } catch (error) {
    console.error('addProgram error:', error);
    return res.status(500).json({ message: 'Server error creating program.' });
  }
};

/**
 * 6. PUT /api/nutrition-corner/programs/:id
 * Admin: Edit existing program
 */
exports.updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const { section, title, description, coverage_metric, sort_order } = req.body;

    await pool.query(
      `UPDATE nutrition_corner_programs
       SET section = ?, title = ?, description = ?, coverage_metric = ?, sort_order = ?
       WHERE id = ?`,
      [section, title, description || '', coverage_metric || null, sort_order || 0, id]
    );

    if (req.user) {
      await logAction(req.user.user_id, 'UPDATE_NUTRITION_PROGRAM', { id, title });
    }

    return res.status(200).json({ message: 'Program updated successfully' });
  } catch (error) {
    console.error('updateProgram error:', error);
    return res.status(500).json({ message: 'Server error updating program.' });
  }
};

/**
 * 7. DELETE /api/nutrition-corner/programs/:id
 * Admin: Delete program
 */
exports.deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM nutrition_corner_programs WHERE id = ?', [id]);

    if (req.user) {
      await logAction(req.user.user_id, 'DELETE_NUTRITION_PROGRAM', { id });
    }

    return res.status(200).json({ message: 'Program deleted successfully' });
  } catch (error) {
    console.error('deleteProgram error:', error);
    return res.status(500).json({ message: 'Server error deleting program.' });
  }
};

/**
 * 8. GET /api/nutrition-corner/laws
 * Fetch reference nutrition laws
 */
exports.getLaws = async (req, res) => {
  try {
    const [laws] = await pool.query(
      `SELECT id, title, legal_basis, description, file_url, category, sort_order
       FROM nutrition_corner_laws
       ORDER BY sort_order ASC, id ASC`
    );
    return res.status(200).json(laws);
  } catch (error) {
    console.error('getLaws error:', error);
    return res.status(500).json({ message: 'Server error retrieving laws.' });
  }
};

/**
 * 9. POST /api/nutrition-corner/laws
 * Admin: Add or update reference law
 */
exports.addLaw = async (req, res) => {
  try {
    const { title, legal_basis, description, file_url, category, sort_order } = req.body;
    if (!title || !legal_basis) {
      return res.status(400).json({ message: 'Title and legal basis are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO nutrition_corner_laws (title, legal_basis, description, file_url, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, legal_basis, description || '', file_url || null, category || 'National Law', sort_order || 0]
    );

    if (req.user) {
      await logAction(req.user.user_id, 'CREATE_NUTRITION_LAW', { id: result.insertId, title });
    }

    return res.status(201).json({ message: 'Law added successfully', id: result.insertId });
  } catch (error) {
    console.error('addLaw error:', error);
    return res.status(500).json({ message: 'Server error adding law.' });
  }
};

/**
 * 10. PUT /api/nutrition-corner/laws/:id
 * Admin: Edit reference law
 */
exports.updateLaw = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, legal_basis, description, file_url, category, sort_order } = req.body;

    await pool.query(
      `UPDATE nutrition_corner_laws
       SET title = ?, legal_basis = ?, description = ?, file_url = ?, category = ?, sort_order = ?
       WHERE id = ?`,
      [title, legal_basis, description || '', file_url || null, category || 'National Law', sort_order || 0, id]
    );

    if (req.user) {
      await logAction(req.user.user_id, 'UPDATE_NUTRITION_LAW', { id, title });
    }

    return res.status(200).json({ message: 'Law updated successfully' });
  } catch (error) {
    console.error('updateLaw error:', error);
    return res.status(500).json({ message: 'Server error updating law.' });
  }
};

/**
 * 11. DELETE /api/nutrition-corner/laws/:id
 * Admin: Delete reference law
 */
exports.deleteLaw = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM nutrition_corner_laws WHERE id = ?', [id]);

    if (req.user) {
      await logAction(req.user.user_id, 'DELETE_NUTRITION_LAW', { id });
    }

    return res.status(200).json({ message: 'Law deleted successfully' });
  } catch (error) {
    console.error('deleteLaw error:', error);
    return res.status(500).json({ message: 'Server error deleting law.' });
  }
};

/**
 * 12. POST /api/nutrition-corner/school-data
 * Admin: Upsert school children nutrition data
 */
exports.saveSchoolData = async (req, res) => {
  try {
    const { school_year, barangay, total_enrolled, total_measured, normal, wasted, severely_wasted, overweight, obese } = req.body;
    if (!school_year) {
      return res.status(400).json({ message: 'School year is required.' });
    }

    const bgy = (barangay || 'All Barangays').trim();

    await pool.query(
      `INSERT INTO nutrition_school_data
         (school_year, barangay, total_enrolled, total_measured, normal, wasted, severely_wasted, overweight, obese, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_enrolled = VALUES(total_enrolled),
         total_measured = VALUES(total_measured),
         normal = VALUES(normal),
         wasted = VALUES(wasted),
         severely_wasted = VALUES(severely_wasted),
         overweight = VALUES(overweight),
         obese = VALUES(obese),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        school_year,
        bgy,
        Number(total_enrolled) || 0,
        Number(total_measured) || 0,
        Number(normal) || 0,
        Number(wasted) || 0,
        Number(severely_wasted) || 0,
        Number(overweight) || 0,
        Number(obese) || 0,
        req.user ? req.user.user_id : null,
      ]
    );

    if (req.user) {
      await logAction(req.user.user_id, 'UPSERT_SCHOOL_NUTRITION_DATA', { school_year, barangay: bgy });
    }

    return res.status(200).json({ message: 'School nutrition data saved successfully.' });
  } catch (error) {
    console.error('saveSchoolData error:', error);
    return res.status(500).json({ message: 'Server error saving school nutrition data.' });
  }
};
