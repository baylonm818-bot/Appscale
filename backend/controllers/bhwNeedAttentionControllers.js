const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

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

  // Rule: overall status = worst of valid indicators.
  // SAM means severe wasting (WFH) ONLY. Do not mix SAM with stunting or underweight.
  if (weightStatus === 'severely_underweight') {
    overallStatus = 'severely_underweight';
  } else if (heightStatus === 'severely_stunted') {
    overallStatus = 'severely_stunted';
  } else if (weightStatus === 'underweight') {
    overallStatus = 'underweight';
  } else if (heightStatus === 'stunted') {
    overallStatus = 'stunted';
  } else if (weightStatus === 'obese') {
    overallStatus = 'obese';
  } else if (weightStatus === 'overweight') {
    overallStatus = 'overweight';
  }

  return { weightStatus, heightStatus, overallStatus };
}

exports.createChildService = async (req, res) => {
  const { child_id, service_date, service_type, service_types, provided_by, weight_kg, height_cm, notes } = req.body;
  const serviceConfigs = {
    vitamin_a: { type: 'Vitamin A', name: 'Vitamin A Supplementation' },
    deworming: { type: 'Deworming', name: 'Deworming Tablet', defaultDosage: 'Albendazole 400mg' },
    feeding: { type: 'Feeding', name: 'Supplementary Feeding' },
    checkup: { type: 'Checkup', name: 'General Health Checkup' },
  };

  // Support multiple services (array) or single service (string)
  let typesToRecord = [];
  if (Array.isArray(service_types) && service_types.length > 0) {
    typesToRecord = service_types.filter((t) => serviceConfigs[t]);
  } else if (service_type && serviceConfigs[service_type]) {
    typesToRecord = [service_type];
  }

  if (!child_id || !service_date || typesToRecord.length === 0) {
    return res.status(400).json({ message: 'Child, date, and at least one valid service type are required.' });
  }

  const providerId = req.user?.user_id || provided_by || null;
  const modifierName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'BHW';

  try {
    const [[child]] = await pool.query(
      'SELECT child_id, first_name, last_name, barangay, age_in_months, sex FROM children WHERE child_id = ?',
      [child_id]
    );
    if (!child) return res.status(404).json({ message: 'Child not found.' });

    const childAge = child.age_in_months || 0;

    // Validate age restrictions
    for (const t of typesToRecord) {
      if (t === 'vitamin_a' && childAge < 6) {
        return res.status(400).json({ message: 'Vitamin A supplementation is not indicated for infants under 6 months.' });
      }
      if (t === 'deworming' && childAge < 12) {
        return res.status(400).json({ message: 'Deworming tablets are not indicated for infants under 12 months.' });
      }
    }

    const insertedServiceNames = [];
    let firstInsertId = null;

    for (const t of typesToRecord) {
      const config = serviceConfigs[t];
      let dosage = config.defaultDosage || null;
      if (t === 'vitamin_a') {
        dosage = childAge < 12 ? '100,000 IU' : '200,000 IU';
      }

      const [result] = await pool.query(
        `INSERT INTO child_services (child_id, service_type, service_name, dosage, service_date, provided_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          child_id,
          config.type,
          config.name,
          dosage,
          service_date,
          providerId,
          notes || null,
        ]
      );
      if (!firstInsertId) firstInsertId = result.insertId;
      insertedServiceNames.push(config.name);
    }

    const hasMeasurement = (weight_kg !== undefined && weight_kg !== null && weight_kg !== '')
      || (height_cm !== undefined && height_cm !== null && height_cm !== '');

    let safeWeight = Number(weight_kg) || 0;
    let safeHeight = Number(height_cm) || 0;

    if (hasMeasurement) {
      const calculated = computeNutritionStatus(
        safeWeight,
        safeHeight,
        child.age_in_months || 0,
        child.sex || 'male'
      );

      const ws = normalizeNutritionStatus(calculated.weightStatus);
      const hs = normalizeNutritionStatus(calculated.heightStatus);
      const os = normalizeNutritionStatus(calculated.overallStatus);

      let bmi = null;
      let bmiStatus = null;
      if (safeWeight > 0 && safeHeight > 0) {
        const hMeters = safeHeight / 100;
        bmi = Number((safeWeight / (hMeters * hMeters)).toFixed(2));
        if (bmi < 18.5) bmiStatus = 'Underweight';
        else if (bmi < 25) bmiStatus = 'Normal';
        else if (bmi < 30) bmiStatus = 'Overweight';
        else bmiStatus = 'Obese';
      }

      const [existing] = await pool.query(
        'SELECT record_id FROM nutrition_records WHERE child_id = ? AND record_date = ? LIMIT 1',
        [child_id, service_date]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE nutrition_records
           SET weight_kg = ?, height_cm = ?, weight_status = ?, height_status = ?,
               overall_status = ?, bmi = ?, bmi_status = ?, recorded_by = ?
           WHERE record_id = ?`,
          [safeWeight, safeHeight, ws, hs, os, bmi, bmiStatus, providerId, existing[0].record_id]
        );
      } else {
        await pool.query(
          `INSERT INTO nutrition_records (
             child_id, record_date, age_in_months, weight_kg, height_cm, muac_cm,
             weight_status, height_status, overall_status, bmi, bmi_status, recorded_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            bmi,
            bmiStatus,
            providerId,
          ]
        );
      }
    }

    // ── Audit Trail (Module 4 Clinical Requirement) ─────────────────────────
    try {
      const servicesLabel = insertedServiceNames.join(', ');
      const auditDetails = `Health visit recorded: ${servicesLabel} on ${service_date}${hasMeasurement ? ` (Weight: ${safeWeight}kg, Height: ${safeHeight}cm)` : ''}${notes ? `. Notes: ${notes}` : ''}`;
      await pool.query(
        `INSERT INTO medical_records_audit_trail (
           record_type, record_id, beneficiary_type, beneficiary_id, beneficiary_name,
           action, action_details, modified_by, modifier_name, timestamp
         ) VALUES ('child_services', ?, 'child', ?, ?, 'CREATE', ?, ?, ?, NOW())`,
        [
          firstInsertId,
          child_id,
          `${child.first_name} ${child.last_name}`,
          auditDetails,
          providerId,
          modifierName,
        ]
      );

      await logAction(pool, req, 'PROVIDE_CHILD_SERVICE', 'child_services', firstInsertId, {
        summary: auditDetails,
        child_name: `${child.first_name} ${child.last_name}`,
        service_type: servicesLabel,
        barangay: child.barangay || req.user?.barangay
      }, child.barangay || req.user?.barangay);
    } catch (auditErr) {
      console.warn('Audit trail insert warning (non-fatal):', auditErr.message);
    }

    // ── Partner Notification (BHW / BNS in barangay) ─────────────────────────
    try {
      const servicesLabel = insertedServiceNames.join(', ');
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, related_id, created_by, recipient_role, barangay, created_at)
         VALUES (?, ?, 'visit', FALSE, ?, ?, 'bhw', ?, NOW())`,
        [
          `Health Visit: ${child.first_name} ${child.last_name}`,
          `Health visit recorded (${servicesLabel}) for ${child.first_name} ${child.last_name} in Barangay ${child.barangay}.`,
          firstInsertId,
          providerId,
          child.barangay,
        ]
      );
    } catch (notifErr) {
      console.warn('Visit notification insert warning (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      message: `${insertedServiceNames.length > 1 ? 'Services' : 'Service'} recorded successfully.`,
      service_id: firstInsertId,
      services_recorded: insertedServiceNames,
      last_visit: service_date,
    });
  } catch (error) {
    console.error('Create child service error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getNeedAttention = async (req, res) => {
  const role = String(req.user?.role || '').toLowerCase();
  let barangay = req.query.barangay || req.user?.barangay || null;

  // Strict barangay scoping for BHW users to ensure they only see their assigned barangay
  if (role === 'bhw' && req.user?.barangay) {
    barangay = req.user.barangay;
  }

  if (!barangay && role !== 'admin') {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nutrition_records' AND COLUMN_NAME = 'wasting_status'`
    );
    const hasWasting = Number(cnt) > 0;

    let childScopeClause = '';
    let childScopeParams = [];

    if (role === 'bns') {
      const [[{ encodedCount }]] = await pool.query(
        `SELECT COUNT(*) AS encodedCount FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'children' AND COLUMN_NAME = 'encoded_by'`
      );

      if (Number(encodedCount) > 0) {
        childScopeClause = 'AND (c.encoded_by IS NULL OR c.encoded_by = ?)';
        childScopeParams = [req.user.user_id];
      }
    }

    const selectCols = [
      'c.child_id', 'c.first_name', 'c.last_name', 'c.middle_initial', 'c.sex', 'c.age_in_months',
      'c.guardian_name', 'c.guardian_contact', 'c.barangay',
      'nr.weight_kg', 'nr.height_cm', 'nr.weight_status', 'nr.height_status',
      'nr.overall_status', 'nr.record_date AS latest_measurement_date',
      `CASE
         WHEN latest_cs.latest_service_date IS NOT NULL AND nr.record_date IS NOT NULL THEN
           GREATEST(nr.record_date, latest_cs.latest_service_date)
         WHEN latest_cs.latest_service_date IS NOT NULL THEN latest_cs.latest_service_date
         ELSE nr.record_date
       END AS last_visit`,
      'CASE WHEN active_ref.referral_id IS NOT NULL THEN 1 ELSE 0 END AS is_referred',
      'active_ref.referral_id AS active_referral_id',
      'active_ref.referral_status',
      'active_ref.referral_date',
      'active_ref.referral_notes',
      'active_ref.referrer_role',
      'active_ref.referrer_name'
    ];
    if (hasWasting) selectCols.splice(13, 0, 'nr.wasting_status');

    const barangayCondition = barangay ? 'c.barangay = ?' : '1=1';
    const queryParams = barangay ? [barangay, ...childScopeParams] : [...childScopeParams];

    const [children] = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM children c
       INNER JOIN (
         SELECT nr1.*
         FROM nutrition_records nr1
         INNER JOIN (
           SELECT child_id, MAX(record_id) AS latest_id
           FROM nutrition_records nr_inner
           INNER JOIN (
             SELECT child_id AS cid, MAX(record_date) AS max_date
             FROM nutrition_records
             GROUP BY child_id
           ) m ON nr_inner.child_id = m.cid AND nr_inner.record_date = m.max_date
           GROUP BY child_id
         ) latest ON nr1.record_id = latest.latest_id
       ) nr ON nr.child_id = c.child_id
       LEFT JOIN (
         SELECT child_id, MAX(service_date) AS latest_service_date
         FROM child_services
         GROUP BY child_id
       ) latest_cs ON latest_cs.child_id = c.child_id
       LEFT JOIN (
         SELECT r.child_id, r.referral_id, r.status AS referral_status, r.created_at AS referral_date, r.notes AS referral_notes,
                UPPER(COALESCE(u.role, 'BHW')) AS referrer_role,
                CONCAT_WS(' ', u.first_name, u.last_name) AS referrer_name
         FROM referrals r
         INNER JOIN (
           SELECT child_id, MAX(referral_id) AS max_ref_id
           FROM referrals
           WHERE LOWER(status) IN ('pending', 'received', 'ongoing', 'responded', 'in progress')
             AND child_id IS NOT NULL
             AND archived_at IS NULL
           GROUP BY child_id
         ) latest_r ON r.referral_id = latest_r.max_ref_id
         LEFT JOIN users u ON u.user_id = r.referred_by
       ) active_ref ON active_ref.child_id = c.child_id
       WHERE ${barangayCondition}
         AND c.status = 'active'
         ${childScopeClause}
         AND (
           nr.overall_status IN ('MAM', 'SAM')
           OR nr.weight_status IN ('underweight', 'severely_underweight', 'severly_underweight')
           OR nr.height_status IN ('stunted', 'severely_stunted', 'severly_stunted')
           ${hasWasting ? "OR nr.wasting_status IN ('wasted','severely_wasted','severly_wasted')" : ''}
         )
       ORDER BY
         CASE
           WHEN nr.overall_status = 'SAM' OR nr.weight_status LIKE '%sever%' OR nr.height_status LIKE '%sever%' THEN 0
           WHEN nr.overall_status = 'MAM' OR nr.weight_status IN ('underweight') OR nr.height_status IN ('stunted') THEN 1
           ELSE 2
         END ASC,
         last_visit ASC`,
      queryParams
    );
    const mappedChildren = children.map((c) => {
      let overall = c.overall_status;
      const ws = String(c.weight_status || '').toLowerCase();
      const hs = String(c.height_status || '').toLowerCase();
      const wst = String(c.wasting_status || '').toLowerCase();
      if (!overall || overall.toLowerCase() === 'normal') {
        if (ws.includes('sever') || hs.includes('sever') || wst.includes('sever')) {
          overall = 'SAM';
        } else if (ws.includes('underweight') || hs.includes('stunted') || wst.includes('wasted')) {
          overall = 'MAM';
        } else if (ws === 'obese') {
          overall = 'obese';
        } else if (ws === 'overweight') {
          overall = 'overweight';
        }
      }
      let destination = '';
      if (c.referral_notes) {
        const match = c.referral_notes.match(/Facility:\s*([^\n\r]+)/i);
        if (match) destination = match[1].trim();
      }
      const roleUpper = String(c.referrer_role || 'BHW').toUpperCase();
      const referrerByLabel = roleUpper === 'BNS' ? 'Referred by BNS' : 'Referred by BHW';

      return {
        ...c,
        beneficiary_type: 'child',
        age_display: `${c.age_in_months ?? 0} mos`,
        overall_status: overall,
        destination_facility: destination || 'BHS / RHU / Hospital',
        referrer_by_label: referrerByLabel,
      };
    });

    // ── At-Risk & Overdue Lactating Mothers ──────────────────────────────────
    let mappedMothers = [];
    try {
      const motherBarangayCondition = barangay ? 'm.barangay = ?' : '1=1';
      const motherQueryParams = barangay ? [barangay] : [];

      const [mothers] = await pool.query(
        `SELECT
           m.mother_id, m.first_name, m.last_name, m.middle_initial, 'F' AS sex,
           m.birth_date, m.purok, m.barangay, m.contact_number AS guardian_contact,
           m.weight_kg, m.height_cm, m.bmi, m.bmi_status, m.muac_cm, m.muac_status,
           latest_ms.latest_service_date AS last_visit,
           CASE WHEN active_ref.referral_id IS NOT NULL THEN 1 ELSE 0 END AS is_referred,
           active_ref.referral_id AS active_referral_id,
           active_ref.referral_status,
           active_ref.referral_date,
           active_ref.referral_notes,
           active_ref.referrer_role,
           active_ref.referrer_name
         FROM mothers m
         LEFT JOIN (
           SELECT mother_id, MAX(service_date) AS latest_service_date
           FROM mother_services
           GROUP BY mother_id
         ) latest_ms ON latest_ms.mother_id = m.mother_id
         LEFT JOIN (
           SELECT r.mother_id, r.referral_id, r.status AS referral_status, r.created_at AS referral_date, r.notes AS referral_notes,
                  UPPER(COALESCE(u.role, 'BHW')) AS referrer_role,
                  CONCAT_WS(' ', u.first_name, u.last_name) AS referrer_name
           FROM referrals r
           INNER JOIN (
             SELECT mother_id, MAX(referral_id) AS max_ref_id
             FROM referrals
             WHERE LOWER(status) IN ('pending', 'received', 'ongoing', 'responded', 'in progress')
               AND mother_id IS NOT NULL
               AND archived_at IS NULL
             GROUP BY mother_id
           ) latest_r ON r.referral_id = latest_r.max_ref_id
           LEFT JOIN users u ON u.user_id = r.referred_by
         ) active_ref ON active_ref.mother_id = m.mother_id
         WHERE ${motherBarangayCondition}
           AND m.status = 'active'
           AND (
             (m.weight_kg IS NOT NULL AND m.weight_kg < 45)
             OR (m.bmi_status IS NOT NULL AND LOWER(m.bmi_status) IN ('underweight', 'severely_underweight'))
             OR (latest_ms.latest_service_date IS NULL OR latest_ms.latest_service_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY))
             OR active_ref.referral_id IS NOT NULL
           )
         ORDER BY last_visit ASC`,
        motherQueryParams
      );

      mappedMothers = mothers.map((m) => {
        let overall = 'At-Risk';
        const weight = Number(m.weight_kg);
        const bmiStat = String(m.bmi_status || '').toLowerCase();
        if (weight > 0 && weight < 45) {
          overall = 'underweight';
        } else if (bmiStat.includes('underweight')) {
          overall = 'underweight';
        } else if (!m.last_visit || (Date.now() - new Date(m.last_visit)) / (1000 * 60 * 60 * 24) > 30) {
          overall = 'overdue';
        }

        let ageInMonths = null;
        let ageDisplay = 'Adult';
        if (m.birth_date) {
          const diffYears = Math.floor((new Date() - new Date(m.birth_date)) / (1000 * 60 * 60 * 24 * 365.25));
          if (diffYears > 0 && diffYears < 120) {
            ageDisplay = `${diffYears} yrs`;
            ageInMonths = diffYears * 12;
          }
        }

        let destination = '';
        if (m.referral_notes) {
          const match = m.referral_notes.match(/Facility:\s*([^\n\r]+)/i);
          if (match) destination = match[1].trim();
        }
        const roleUpper = String(m.referrer_role || 'BHW').toUpperCase();
        const referrerByLabel = roleUpper === 'BNS' ? 'Referred by BNS' : 'Referred by BHW';

        return {
          ...m,
          beneficiary_type: 'mother',
          child_id: null,
          guardian_name: null,
          age_in_months: ageInMonths,
          age_display: ageDisplay,
          overall_status: overall,
          destination_facility: destination || 'BHS / RHU / Hospital',
          referrer_by_label: referrerByLabel,
        };
      });
    } catch (mErr) {
      console.warn('Get mothers in need-attention warning (non-fatal):', mErr.message);
    }

    const combined = [...mappedChildren, ...mappedMothers];
    return res.status(200).json(combined);
  } catch (error) {
    console.error('Get need attention error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};