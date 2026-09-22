const pool = require('../config/db');

exports.createReferral = async (req, res) => {
  const { child_id, beneficiary_name, beneficiary_type, barangay, facility, notes, severity, reason, referred_by } = req.body;

  if ((!child_id && !beneficiary_name) || !reason) {
    return res.status(400).json({ message: 'Beneficiary and referral reason are required.' });
  }

  try {
    let resolvedChildId = child_id;
    let childQuery;
    if (child_id) {
      childQuery = await pool.query(
        `SELECT c.child_id, c.first_name, c.last_name, c.barangay
         FROM children c
         WHERE c.child_id = ?`,
        [child_id]
      );
    } else if (beneficiary_type === 'child' && beneficiary_name && barangay) {
      childQuery = await pool.query(
        `SELECT c.child_id, c.first_name, c.last_name, c.barangay
         FROM children c
         WHERE c.barangay = ?
           AND CONCAT_WS(' ', c.first_name, c.middle_initial, c.last_name) = ?
         LIMIT 2`,
        [barangay, beneficiary_name.trim()]
      );
    } else {
      return res.status(400).json({ message: 'Only child referrals can be sent to the BHW web portal.' });
    }

    const [children] = childQuery;
    const child = children[0];
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (children.length > 1) return res.status(409).json({ message: 'Multiple children match this referral.' });
    resolvedChildId = child.child_id;

    const [[referrer]] = await pool.query(
      `SELECT user_id FROM users
       WHERE status = 'active' AND deleted_at IS NULL
         AND (? IS NULL OR barangay = ?)
       ORDER BY user_id ASC LIMIT 1`,
      [barangay || child.barangay, barangay || child.barangay]
    );
    if (!referrer && !referred_by) return res.status(500).json({ message: 'No active referring user is available.' });

    const referringUserId = referred_by || referrer.user_id;
    const referralNotes = [facility ? `Facility: ${facility}` : '', notes || ''].filter(Boolean).join('\n');

    const [result] = await pool.query(
      `INSERT INTO referrals (child_id, referred_by, referred_to, reason, severity, status, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [resolvedChildId, referringUserId, referrer?.user_id || referred_by, reason, severity || 'medium', referralNotes || null]
    );

    await pool.query(
      `INSERT INTO notifications (title, message, type, is_read, related_id, created_by)
       VALUES (?, ?, 'referral', FALSE, ?, ?)`,
      [
        'New Referral Submitted',
        `${child.first_name} ${child.last_name} from ${child.barangay || 'Unknown Barangay'} needs follow-up (${severity || 'medium'} severity).`,
        result.insertId,
        referringUserId,
      ]
    );

    return res.status(201).json({ message: 'Referral submitted successfully.', referral_id: result.insertId });
  } catch (error) {
    console.error('Create referral error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getReferrals = async (req, res) => {
  const { barangay } = req.query;

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [referrals] = await pool.query(
      `SELECT
         r.referral_id, r.reason, r.severity, r.status, r.referred_by, r.referred_to, r.notes AS response_notes, r.created_at,
         c.child_id, c.first_name AS child_first_name, c.last_name AS child_last_name, c.guardian_name
       FROM referrals r
       LEFT JOIN children c ON c.child_id = r.child_id
       WHERE c.barangay = ?
       ORDER BY FIELD(r.status, 'pending', 'responded', 'closed'), r.created_at DESC`,
      [barangay]
    );
    return res.status(200).json(referrals);
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
      'SELECT child_id FROM referrals WHERE referral_id = ?',
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
    if (status === 'responded' && serviceLabels[service_type] && service_date && provided_by) {
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