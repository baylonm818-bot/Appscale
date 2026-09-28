const pool = require('../config/db');
const bcrypt = require('bcrypt');

function canAccessProfile(req, targetId) {
  const requesterId = Number(req.user?.user_id);
  const target = Number(targetId);
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'admin' || requesterId === target;
}

exports.getProfile = async (req, res) => {
  const { id } = req.params;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to view this profile.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT user_id, first_name, middle_initial, last_name, email, username,
              role, municipality, barangay, purok, contact_number, profile_picture
       FROM users WHERE user_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { id } = req.params;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to update this profile.' });
  }

  const { first_name, middle_initial, last_name, email, contact_number, purok } = req.body;

  try {
    if (email) {
      const [existing] = await pool.query(
        'SELECT user_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND user_id <> ? LIMIT 1',
        [email, id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: 'Email is already in use by another account.' });
      }
    }

    await pool.query(
      `UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, contact_number = ?, purok = ?
       WHERE user_id = ?`,
      [first_name, middle_initial || null, last_name, email, contact_number, purok || null, id]
    );
    return res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.changePassword = async (req, res) => {
  const { id } = req.params;
  const requesterId = Number(req.user?.user_id);

  if (requesterId !== Number(id)) {
    return res.status(403).json({ message: 'Forbidden. You can only change your own password.' });
  }

  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, id]);
    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};