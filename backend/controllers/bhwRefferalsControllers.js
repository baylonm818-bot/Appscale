const pool = require('../config/db');
const { canAccessReferral } = require('../utils/roleAccess');

function normalizeIdValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function isNumericId(value) {
  const trimmed = normalizeIdValue(value);
  if (!trimmed) return false;
  return /^\d+$/.test(trimmed);
}

async function getReferralTableMeta() {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referrals'`
  );

  const names = new Set(columns.map((column) => column.COLUMN_NAME));
  return {
    hasChildId: names.has('child_id'),
    hasMotherId: names.has('mother_id'),
    hasBeneficiaryType: names.has('beneficiary_type'),
  };
}

exports.createReferral = async (req, res) => {
  const {
    child_id,
    mother_id,
    beneficiary_name,
    beneficiary_type,
    barangay,
    facility,
    notes,
    severity,
    reason,
    referred_by,
  } = req.body;

  if ((!child_id && !mother_id && !beneficiary_name) || !reason) {
    return res.status(400).json({ message: 'Beneficiary and referral reason are required.' });
  }

  try {
    const { hasChildId, hasMotherId, hasBeneficiaryType } = await getReferralTableMeta();
    let resolvedChildId = child_id || null;
    let resolvedMotherId = mother_id || null;
    let beneficiaryType = beneficiary_type || (resolvedChildId ? 'child' : 'mother');
    let targetBarangay = barangay || null;
    let targetDisplayName = beneficiary_name || null;
    let targetLabel = 'Beneficiary';

    if (beneficiaryType === 'child') {
      let childQuery;
      if (resolvedChildId) {
        if (isNumericId(resolvedChildId)) {
          childQuery = await pool.query(
            `SELECT c.child_id, c.first_name, c.last_name, c.barangay
             FROM children c
             WHERE c.child_id = ?`,
            [Number(resolvedChildId)]
          );
        } else {
          childQuery = await pool.query(
            `SELECT c.child_id, c.first_name, c.last_name, c.barangay
             FROM children c
             WHERE c.external_id = ?`,
            [normalizeIdValue(resolvedChildId)]
          );
          if (childQuery[0].length === 0 && targetDisplayName && targetBarangay) {
            childQuery = await pool.query(
              `SELECT c.child_id, c.first_name, c.last_name, c.barangay
               FROM children c
               WHERE LOWER(TRIM(c.barangay)) = LOWER(TRIM(?))
                 AND (
                   CONCAT_WS(' ', c.first_name, c.last_name) = ?
                   OR CONCAT_WS(' ', c.first_name, c.middle_initial, c.last_name) = ?
                 )
               LIMIT 2`,
              [targetBarangay, targetDisplayName.trim(), targetDisplayName.trim()]
            );
          }
        }
      } else if (targetDisplayName && targetBarangay) {
        childQuery = await pool.query(
          `SELECT c.child_id, c.first_name, c.last_name, c.barangay
           FROM children c
           WHERE LOWER(TRIM(c.barangay)) = LOWER(TRIM(?))
             AND (
               CONCAT_WS(' ', c.first_name, c.last_name) = ?
               OR CONCAT_WS(' ', c.first_name, c.middle_initial, c.last_name) = ?
             )
           LIMIT 2`,
          [targetBarangay, targetDisplayName.trim(), targetDisplayName.trim()]
        );
      } else {
        return res.status(400).json({ message: 'Child referral requires a valid child or child name and barangay.' });
      }

      const [children] = childQuery;
      const child = children[0];
      if (!child) return res.status(404).json({ message: 'Child not found.' });
      if (children.length > 1) return res.status(409).json({ message: 'Multiple children match this referral.' });

      resolvedChildId = child.child_id;
      targetDisplayName = `${child.first_name} ${child.last_name}`;
      targetBarangay = child.barangay || targetBarangay;
      targetLabel = targetDisplayName;
    } else {
      let motherQuery;
      if (resolvedMotherId) {
        if (isNumericId(resolvedMotherId)) {
          motherQuery = await pool.query(
            `SELECT m.mother_id, m.first_name, m.last_name, m.barangay
             FROM mothers m
             WHERE m.mother_id = ?`,
            [Number(resolvedMotherId)]
          );
        } else {
          motherQuery = await pool.query(
            `SELECT m.mother_id, m.first_name, m.last_name, m.barangay
             FROM mothers m
             WHERE m.external_id = ?`,
            [normalizeIdValue(resolvedMotherId)]
          );
          if (motherQuery[0].length === 0 && targetDisplayName && targetBarangay) {
            motherQuery = await pool.query(
              `SELECT m.mother_id, m.first_name, m.last_name, m.barangay
               FROM mothers m
               WHERE LOWER(TRIM(m.barangay)) = LOWER(TRIM(?))
                 AND (
                   CONCAT_WS(' ', m.first_name, m.last_name) = ?
                   OR CONCAT_WS(' ', m.first_name, m.middle_initial, m.last_name) = ?
                 )
               LIMIT 2`,
              [targetBarangay, targetDisplayName.trim(), targetDisplayName.trim()]
            );
          }
        }
      } else if (targetDisplayName && targetBarangay) {
        motherQuery = await pool.query(
          `SELECT m.mother_id, m.first_name, m.last_name, m.barangay
           FROM mothers m
           WHERE LOWER(TRIM(m.barangay)) = LOWER(TRIM(?))
             AND (
               CONCAT_WS(' ', m.first_name, m.last_name) = ?
               OR CONCAT_WS(' ', m.first_name, m.middle_initial, m.last_name) = ?
             )
           LIMIT 2`,
          [targetBarangay, targetDisplayName.trim(), targetDisplayName.trim()]
        );
      } else {
        return res.status(400).json({ message: 'Mother referral requires a valid mother or mother name and barangay.' });
      }

      const [mothers] = motherQuery;
      const mother = mothers[0];
      if (!mother) return res.status(404).json({ message: 'Mother not found.' });
      if (mothers.length > 1) return res.status(409).json({ message: 'Multiple mothers match this referral.' });

      resolvedMotherId = mother.mother_id;
      targetDisplayName = `${mother.first_name} ${mother.last_name}`;
      targetBarangay = mother.barangay || targetBarangay;
      targetLabel = targetDisplayName;
    }

    // ── Determine referring user ──────────────────────────────────────────────
    // Priority: (1) body.referred_by, (2) JWT user_id, (3) any active user in barangay
    const jwtUserId = req.user?.user_id || null;

    const [[referrer]] = await pool.query(
      `SELECT user_id FROM users
       WHERE status = 'active' AND deleted_at IS NULL
         AND (? IS NULL OR barangay = ?)
       ORDER BY user_id ASC LIMIT 1`,
      [targetBarangay || null, targetBarangay || null]
    );

    const referringUserId = referred_by || jwtUserId || referrer?.user_id || null;

    if (!referringUserId) {
      return res.status(400).json({ message: 'Could not determine referring user. Please log in again.' });
    }

    const referralNotes = [facility ? `Facility: ${facility}` : '', notes || ''].filter(Boolean).join('\n');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ── Duplicate check (case-insensitive status) ─────────────────────────
      const [existing] = await conn.query(
        `SELECT referral_id
         FROM referrals
         WHERE LOWER(status) IN ('pending', 'ongoing', 'responded')
           AND (
             (? IS NOT NULL AND child_id = ?)
             OR (? IS NOT NULL AND mother_id = ?)
           )
           AND COALESCE(beneficiary_type, CASE WHEN child_id IS NOT NULL THEN 'child' ELSE 'mother' END) = ?
           AND LOWER(TRIM(reason)) = LOWER(TRIM(?))
         LIMIT 1`,
        [
          resolvedChildId,
          resolvedChildId,
          resolvedMotherId,
          resolvedMotherId,
          beneficiaryType,
          reason,
        ]
      );

      if (existing[0]) {
        await conn.rollback();
        conn.release();
        return res.status(200).json({
          message: 'Referral already exists for this beneficiary and reason.',
          referral_id: existing[0].referral_id,
          duplicate: true,
        });
      }

      // ── Build dynamic INSERT based on actual table columns ────────────────
      const insertFields = [];
      const insertValues = [];

      if (hasChildId && resolvedChildId) {
        insertFields.push('child_id');
        insertValues.push(resolvedChildId);
      }

      if (hasMotherId && resolvedMotherId) {
        insertFields.push('mother_id');
        insertValues.push(resolvedMotherId);
      }

      if (hasBeneficiaryType) {
        insertFields.push('beneficiary_type');
        insertValues.push(beneficiaryType);
      }

      insertFields.push('referred_by', 'referred_to', 'reason', 'severity', 'status', 'notes');
      insertValues.push(
        referringUserId,
        facility || null,
        reason,
        severity || 'medium',
        'Pending',
        referralNotes || null,
      );

      const [result] = await conn.query(
        `INSERT INTO referrals (${insertFields.join(', ')})
         VALUES (${insertFields.map(() => '?').join(', ')})`,
        insertValues
      );

      await conn.commit();
      conn.release();

      // ── Notification — NON-FATAL, runs outside transaction ────────────────
      // Missing columns in notifications table must NOT undo a successfully saved referral.
      try {
        const [notifCols] = await pool.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'`
        );
        const notifColSet = new Set(notifCols.map((c) => c.COLUMN_NAME));

        const nf = ['title', 'message', 'type', 'is_read'];
        const nv = [
          'New Referral Submitted',
          `${targetLabel} from ${targetBarangay || 'Unknown Barangay'} needs follow-up (${severity || 'medium'} severity).`,
          'referral',
          false,
        ];

        if (notifColSet.has('related_id')) { nf.push('related_id'); nv.push(result.insertId); }
        if (notifColSet.has('created_by')) { nf.push('created_by'); nv.push(referringUserId); }
        if (notifColSet.has('created_at')) { nf.push('created_at'); nv.push(new Date()); }

        await pool.query(
          `INSERT INTO notifications (${nf.join(', ')}) VALUES (${nf.map(() => '?').join(', ')})`,
          nv
        );
      } catch (notifErr) {
        console.error('Referral notification insert failed (non-fatal):', notifErr.message);
      }

      return res.status(201).json({ message: 'Referral submitted successfully.', referral_id: result.insertId });
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
  } catch (error) {
    console.error('Create referral error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.', debug: error.message, code: error.code });
  }
};

exports.getReferrals = async (req, res) => {
  const user = req.user;

  // Admin can query all referrals; BHW/BNS need barangay
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  if (!isAdmin && !user?.barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const whereClause = isAdmin
      ? '1=1'
      : 'COALESCE(c.barangay, m.barangay) = ?';
    const params = isAdmin ? [] : [user.barangay];

    const [referrals] = await pool.query(
      `SELECT DISTINCT
         r.referral_id,
         CASE
           WHEN c.child_id IS NOT NULL THEN 'child'
           WHEN m.mother_id IS NOT NULL THEN 'mother'
           ELSE 'child'
         END AS beneficiary_type,
         r.reason,
         r.severity,
         r.status,
         r.referred_by,
         r.referred_to,
         r.notes AS response_notes,
         r.created_at,
         c.child_id,
         c.first_name AS child_first_name,
         c.last_name AS child_last_name,
         c.guardian_name,
         m.mother_id,
         m.first_name AS mother_first_name,
         m.last_name AS mother_last_name,
         COALESCE(c.barangay, m.barangay) AS beneficiary_barangay,
         COALESCE(c.first_name, m.first_name) AS beneficiary_first_name,
         COALESCE(c.last_name, m.last_name) AS beneficiary_last_name,
         COALESCE(c.barangay, m.barangay) AS barangay
       FROM referrals r
       LEFT JOIN children c ON c.child_id = r.child_id
       LEFT JOIN mothers m ON m.mother_id = r.mother_id
       WHERE ${whereClause}
       ORDER BY FIELD(LOWER(r.status), 'pending', 'ongoing', 'responded', 'cancelled', 'completed', 'closed'), r.created_at DESC`,
      params
    );

    const allowedReferrals = referrals.map((ref) => {
      // Normalize status labels for display
      let normalizedStatus = ref.status;
      const lower = String(ref.status || '').toLowerCase();
      if (lower === 'pending') normalizedStatus = 'Pending';
      else if (lower === 'ongoing' || lower === 'responded') normalizedStatus = 'Ongoing';
      else if (lower === 'cancelled') normalizedStatus = 'Cancelled';
      else if (lower === 'completed' || lower === 'closed') normalizedStatus = 'Completed';
      return { ...ref, status: normalizedStatus };
    }).filter((referral) => canAccessReferral(user, referral));

    return res.status(200).json(allowedReferrals);
  } catch (error) {
    console.error('Get referrals error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.updateReferralStatus = async (req, res) => {
  const { id } = req.params;
  const { status, response_notes, service_type, service_date, provided_by } = req.body;

  const statusMap = {
    pending: 'Pending',
    ongoing: 'Ongoing',
    responded: 'Ongoing',
    completed: 'Completed',
    closed: 'Completed',
  };

  const normalizedStatus = statusMap[String(status || '').toLowerCase()];

  if (!normalizedStatus) {
    return res.status(400).json({ message: 'Invalid status value. Allowed: Pending, Ongoing, Completed.' });
  }

  try {
    const [[referral]] = await pool.query(
      'SELECT child_id, mother_id FROM referrals WHERE referral_id = ?',
      [id]
    );
    if (!referral) return res.status(404).json({ message: 'Referral not found.' });

    await pool.query(
      'UPDATE referrals SET status = ?, notes = ? WHERE referral_id = ?',
      [normalizedStatus, response_notes || null, id]
    );

    const serviceLabels = {
      vitamin_a: 'Vitamin A',
      deworming: 'Deworming',
      feeding: 'Feeding',
      checkup: 'Checkup',
    };

    if (normalizedStatus === 'Ongoing' && serviceLabels[service_type] && service_date && provided_by && referral.child_id) {
      await pool.query(
        `INSERT INTO child_services (child_id, service_type, service_date, provided_by)
         VALUES (?, ?, ?, ?)`,
        [referral.child_id, serviceLabels[service_type], service_date, provided_by]
      );
    }

    return res.status(200).json({ message: 'Referral status updated.', status: normalizedStatus });
  } catch (error) {
    console.error('Update referral status error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};