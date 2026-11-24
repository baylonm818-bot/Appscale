const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { validateContactNumber } = require('../utils/contactValidation');

function canAccessProfile(req, targetId) {
  const requesterId = Number(req.user?.user_id);
  const target = (!targetId || targetId === 'me') ? requesterId : Number(targetId);
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'admin' || requesterId === target;
}

async function attachUserStats(user) {
  if (!user) return user;
  const userBarangay = (user.barangay || '').trim();
  let totalChildren = 0;
  let totalMothers = 0;
  if (userBarangay) {
    try {
      const [[childStats]] = await pool.query(
        `SELECT COUNT(*) AS total FROM children WHERE (LOWER(TRIM(barangay)) = LOWER(TRIM(?)) OR ? = 'All Barangays') AND status = 'active'`,
        [userBarangay, userBarangay]
      );
      totalChildren = childStats ? Number(childStats.total || 0) : 0;
    } catch (e) {
      console.error('attachUserStats children count error:', e);
    }
    try {
      const [[motherStats]] = await pool.query(
        `SELECT COUNT(*) AS total FROM mothers WHERE (LOWER(TRIM(barangay)) = LOWER(TRIM(?)) OR ? = 'All Barangays') AND status = 'active'`,
        [userBarangay, userBarangay]
      );
      totalMothers = motherStats ? Number(motherStats.total || 0) : 0;
    } catch (e) {
      console.error('attachUserStats mothers count error:', e);
    }
  } else if (String(user.role || '').toLowerCase() === 'admin') {
    try {
      const [[childStats]] = await pool.query(`SELECT COUNT(*) AS total FROM children WHERE status = 'active'`);
      totalChildren = childStats ? Number(childStats.total || 0) : 0;
      const [[motherStats]] = await pool.query(`SELECT COUNT(*) AS total FROM mothers WHERE status = 'active'`);
      totalMothers = motherStats ? Number(motherStats.total || 0) : 0;
    } catch (e) {
      console.error('attachUserStats admin counts error:', e);
    }
  }
  user.active_children_count = totalChildren;
  user.active_mothers_count = totalMothers;
  user.health_station = userBarangay
    ? (userBarangay.toLowerCase().startsWith('barangay ')
        ? `${userBarangay} Health Station`
        : `${userBarangay} Barangay Health Station`)
    : 'Rural Health Unit';
  return user;
}

exports.getProfile = async (req, res) => {
  const rawId = req.params.id;
  const id = (!rawId || rawId === 'me') ? req.user?.user_id : rawId;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to view this profile.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT user_id, first_name, middle_initial, last_name, email, username,
              role, municipality, barangay, purok, contact_number, profile_picture,
              COALESCE(language, 'en') AS language, COALESCE(age_format_days, 0) AS age_format_days
       FROM users WHERE user_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = rows[0];
    const pic = user.profile_picture;
    if (pic && !pic.startsWith('data:') && !pic.startsWith('http')) {
      const base = process.env.APP_BASE_URL || 'https://appscale-1.onrender.com';
      user.profile_picture = `${base}${pic.startsWith('/') ? '' : '/'}${pic}`;
    }
    user.full_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    await attachUserStats(user);
    return res.status(200).json(user);
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

  const { first_name, middle_initial, last_name, email, contact_number, purok, profile_picture, language, age_format_days } = req.body;

  try {
    const [existingUserRows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUserRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const current = existingUserRows[0];

    const updatedFirstName = first_name !== undefined ? String(first_name).trim() : current.first_name;
    const updatedMiddleInitial = middle_initial !== undefined ? (middle_initial ? String(middle_initial).trim() : null) : current.middle_initial;
    const updatedLastName = last_name !== undefined ? String(last_name).trim() : current.last_name;
    const updatedEmail = email !== undefined ? String(email).trim() : current.email;
    const updatedLanguage = language !== undefined ? (String(language).toLowerCase() === 'tl' ? 'tl' : 'en') : (current.language || 'en');
    const updatedAgeFormatDays = age_format_days !== undefined ? (age_format_days ? 1 : 0) : (current.age_format_days || 0);

    let updatedContactNumber = current.contact_number;
    if (contact_number !== undefined) {
      if (contact_number && String(contact_number).trim() !== '') {
        const contactCheck = validateContactNumber(contact_number);
        if (!contactCheck.valid) {
          return res.status(400).json({ message: contactCheck.message });
        }
        updatedContactNumber = contactCheck.value;
      } else {
        updatedContactNumber = null;
      }
    }

    const updatedPurok = purok !== undefined ? (purok ? String(purok).trim() : null) : current.purok;
    const updatedProfilePicture = profile_picture !== undefined ? profile_picture : current.profile_picture;

    if (updatedEmail && updatedEmail.toLowerCase() !== String(current.email || '').toLowerCase()) {
      const [existing] = await pool.query(
        'SELECT user_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND user_id <> ? LIMIT 1',
        [updatedEmail, id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: 'Email is already in use by another account.' });
      }
    }

    await pool.query(
      `UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, contact_number = ?, purok = ?, profile_picture = ?, language = ?, age_format_days = ?
       WHERE user_id = ?`,
      [updatedFirstName, updatedMiddleInitial, updatedLastName, updatedEmail, updatedContactNumber, updatedPurok, updatedProfilePicture, updatedLanguage, updatedAgeFormatDays, id]
    );

    const [updatedRows] = await pool.query(
      `SELECT user_id, first_name, middle_initial, last_name, email, username,
              role, municipality, barangay, purok, contact_number, profile_picture,
              COALESCE(language, 'en') AS language, COALESCE(age_format_days, 0) AS age_format_days
       FROM users WHERE user_id = ?`,
      [id]
    );
    const updatedUser = updatedRows[0];
    updatedUser.full_name = `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || updatedUser.username;
    if (updatedUser.profile_picture && !updatedUser.profile_picture.startsWith('data:') && !updatedUser.profile_picture.startsWith('http')) {
      const base = process.env.APP_BASE_URL || 'https://appscale-1.onrender.com';
      updatedUser.profile_picture = `${base}${updatedUser.profile_picture.startsWith('/') ? '' : '/'}${updatedUser.profile_picture}`;
    }

    await attachUserStats(updatedUser);
    return res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
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