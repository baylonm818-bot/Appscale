const pool = require('../config/db');

function normalizeNutritionStatus(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const aliases = {
    severely_underweight: 'severely_underweight',
    underweight: 'underweight',
    normal: 'normal',
    severely_stunted: 'severely_stunted',
    stunted: 'stunted',
    obese: 'obese',
    overweight: 'overweight',
    sam: 'SAM',
    mam: 'MAM',
  };

  return aliases[normalized] ?? normalized;
}

function computeNutritionStatus(weightKg, heightCm, ageMonths, sex) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const age = Number(ageMonths) || 0;

  let weightStatus = 'normal';
  let heightStatus = 'normal';
  let overallStatus = 'normal';

  if (w > 0 && age > 0) {
    const expectedWeight = (age * 0.5) + 4;
    if (w < expectedWeight * 0.7) weightStatus = 'severely_underweight';
    else if (w < expectedWeight * 0.85) weightStatus = 'underweight';
    else if (w > expectedWeight * 1.3) weightStatus = 'obese';
    else if (w > expectedWeight * 1.15) weightStatus = 'overweight';
  }

  if (h > 0 && age > 0) {
    const expectedHeight = 50 + (age * 1.2);
    if (h < expectedHeight * 0.85) heightStatus = 'severely_stunted';
    else if (h < expectedHeight * 0.92) heightStatus = 'stunted';
  }

  if (weightStatus === 'severely_underweight' || heightStatus === 'severely_stunted') {
    overallStatus = 'SAM';
  } else if (weightStatus === 'underweight' || heightStatus === 'stunted') {
    overallStatus = 'MAM';
  } else if (weightStatus === 'obese') {
    overallStatus = 'obese';
  } else if (weightStatus === 'overweight') {
    overallStatus = 'overweight';
  }

  return { weightStatus, heightStatus, overallStatus };
}

exports.createChildService = async (req, res) => {
  const { child_id, service_date, service_type, provided_by, weight_kg, height_cm, notes } = req.body;
  const serviceLabels = {
    vitamin_a: 'Vitamin A',
    deworming: 'Deworming',
    feeding: 'Feeding',
    checkup: 'Checkup',
  };

  if (!child_id || !service_date || !serviceLabels[service_type] || !provided_by) {
    return res.status(400).json({ message: 'Child, date, service, and provider are required.' });
  }

  try {
    const [[child]] = await pool.query(
      'SELECT child_id, age_in_months, sex FROM children WHERE child_id = ?',
      [child_id]
    );
    if (!child) return res.status(404).json({ message: 'Child not found.' });

    const [result] = await pool.query(
      `INSERT INTO child_services (child_id, service_type, service_date, provided_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [child_id, serviceLabels[service_type], service_date, provided_by, notes || null]
    );

    const hasMeasurement = weight_kg !== undefined && weight_kg !== null && weight_kg !== ''
      || height_cm !== undefined && height_cm !== null && height_cm !== '';

    if (hasMeasurement) {
      const safeWeight = Number(weight_kg) || 0;
      const safeHeight = Number(height_cm) || 0;
      const calculated = computeNutritionStatus(
        safeWeight,
        safeHeight,
        child.age_in_months || 0,
        child.sex || 'male'
      );

      const ws = normalizeNutritionStatus(calculated.weightStatus);
      const hs = normalizeNutritionStatus(calculated.heightStatus);
      const os = normalizeNutritionStatus(calculated.overallStatus);

      const [existing] = await pool.query(
        'SELECT nutrition_record_id FROM nutrition_records WHERE child_id = ? AND record_date = ? LIMIT 1',
        [child_id, service_date]
      );

      if (!existing.length) {
        await pool.query(
          `INSERT INTO nutrition_records (
             child_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
             weight_status, height_status, overall_status, recorded_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            child_id,
            service_date,
            child.age_in_months || 0,
            safeWeight,
            safeHeight,
            0,
            ws,
            hs,
            os,
            provided_by,
          ]
        );
      }
    }

    return res.status(201).json({ message: 'Child service recorded.', service_id: result.insertId });
  } catch (error) {
    console.error('Create child service error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getNeedAttention = async (req, res) => {
  const { barangay } = req.query;

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const role = String(req.user?.role || '').toLowerCase();
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_DATABASE || process.env.DB_NAME || 'appscale_db', 'nutrition_records', 'wasting_status']
    );
    const hasWasting = Number(cnt) > 0;

    let childScopeClause = '';
    let childScopeParams = [];

    if (role === 'bns') {
      const [[{ encodedCount }]] = await pool.query(
        `SELECT COUNT(*) AS encodedCount FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_DATABASE || process.env.DB_NAME || 'appscale_db', 'children', 'encoded_by']
      );

      if (Number(encodedCount) > 0) {
        childScopeClause = 'AND (c.encoded_by IS NULL OR c.encoded_by = ?)';
        childScopeParams = [req.user.user_id];
      }
    }

    const selectCols = [
      'c.child_id', 'c.first_name', 'c.last_name', 'c.sex', 'c.age_in_months',
      'c.guardian_name', 'c.guardian_contact',
      'nr.weight_kg', 'nr.height_cm', 'nr.weight_status', 'nr.height_status',
      'nr.overall_status', 'nr.record_date AS last_visit'
    ];
    if (hasWasting) selectCols.splice(10, 0, 'nr.wasting_status');

    const [children] = await pool.query(
      `SELECT ${selectCols.join(', ')}
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
       WHERE c.barangay = ?
         AND c.status = 'active'
         ${childScopeClause}
         AND (
           nr.overall_status IN ('MAM', 'SAM')
           OR nr.weight_status IN ('underweight', 'severely_underweight', 'severly_underweight')
           OR nr.height_status IN ('stunted', 'severely_stunted', 'severly_stunted')
           ${hasWasting ? "OR nr.wasting_status IN ('wasted','severely_wasted','severly_wasted')" : ''}
         )
       ORDER BY
         FIELD(nr.overall_status, 'SAM', 'MAM') ASC,
         nr.record_date ASC`,
      [barangay, ...childScopeParams]
    );
    return res.status(200).json(children);
  } catch (error) {
    console.error('Get need attention error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};