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
        }
      } else if (targetDisplayName && targetBarangay) {
        childQuery = await pool.query(
          `SELECT c.child_id, c.first_name, c.last_name, c.barangay
           FROM children c
           WHERE c.barangay = ?
             AND CONCAT_WS(' ', c.first_name, c.middle_initial, c.last_name) = ?
           LIMIT 2`,
          [targetBarangay, targetDisplayName.trim()]
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
        }
      } else if (targetDisplayName && targetBarangay) {
        motherQuery = await pool.query(
          `SELECT m.mother_id, m.first_name, m.last_name, m.barangay
           FROM mothers m
           WHERE m.barangay = ?
             AND CONCAT_WS(' ', m.first_name, m.middle_initial, m.last_name) = ?
           LIMIT 2`,
          [targetBarangay, targetDisplayName.trim()]
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

    const [[referrer]] = await pool.query(
      `SELECT user_id FROM users
       WHERE status = 'active' AND deleted_at IS NULL
         AND (? IS NULL OR barangay = ?)
       ORDER BY user_id ASC LIMIT 1`,
      [targetBarangay || null, targetBarangay || null]
    );

    if (!referrer && !referred_by) {
      return res.status(500).json({ message: 'No active referring user is available.' });
    }

    const referringUserId = referred_by || referrer.user_id;
    const referralNotes = [facility ? `Facility: ${facility}` : '', notes || ''].filter(Boolean).join('\n');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query(
        `SELECT referral_id
         FROM referrals
         WHERE status IN ('pending', 'responded')
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
        referrer?.user_id || referred_by,
        reason,
        severity || 'medium',
        'pending',
        referralNotes || null,
      );

      const [result] = await conn.query(
        `INSERT INTO referrals (${insertFields.join(', ')})
         VALUES (${insertFields.map(() => '?').join(', ')})`,
        insertValues
      );

      await conn.query(
        `INSERT INTO notifications (title, message, type, is_read, related_id, created_by)
         VALUES (?, ?, 'referral', FALSE, ?, ?)`,
        [
          'New Referral Submitted',
          `${targetLabel} from ${targetBarangay || 'Unknown Barangay'} needs follow-up (${severity || 'medium'} severity).`,
          result.insertId,
          referringUserId,
        ]
      );

      await conn.commit();
      conn.release();
      return res.status(201).json({ message: 'Referral submitted successfully.', referral_id: result.insertId });
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
  } catch (error) {
    console.error('Create referral error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getReferrals = async (req, res) => {
  const user = req.user;

  if (!user?.barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [referrals] = await pool.query(
      `SELECT DISTINCT
         r.referral_id,
         r.beneficiary_type,
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
       WHERE COALESCE(c.barangay, m.barangay) = ?
       ORDER BY FIELD(r.status, 'pending', 'responded', 'closed'), r.created_at DESC`,
      [user.barangay]
    );

    const allowedReferrals = referrals.filter((referral) => canAccessReferral(user, referral));
    return res.status(200).json(allowedReferrals);
  } catch (error) {
    console.error('Get referrals error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.updateReferralStatus = async (req, res) => {
  const { id } = req.params;
  const { status, response_notes, service_type, service_date, provided_by } = req.body;

  if (!['pending', 'responded', 'closed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    const [[referral]] = await pool.query(
      'SELECT child_id, mother_id FROM referrals WHERE referral_id = ?',
      [id]
    );
    if (!referral) return res.status(404).json({ message: 'Referral not found.' });

    await pool.query(
      'UPDATE referrals SET status = ?, notes = ? WHERE referral_id = ?',
      [status, response_notes || null, id]
    );

    const serviceLabels = {
      vitamin_a: 'Vitamin A',
      deworming: 'Deworming',
      feeding: 'Feeding',
      checkup: 'Checkup',
    };

    if (status === 'responded' && serviceLabels[service_type] && service_date && provided_by && referral.child_id) {
      await pool.query(
        `INSERT INTO child_services (child_id, service_type, service_date, provided_by)
         VALUES (?, ?, ?, ?)`,
        [referral.child_id, serviceLabels[service_type], service_date, provided_by]
      );
    }

    return res.status(200).json({ message: 'Referral status updated.' });
  } catch (error) {
    console.error('Update referral status error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};