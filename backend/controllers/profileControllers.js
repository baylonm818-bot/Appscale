const pool = require('../config/db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pictures');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user_${req.params.id}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!allowedMime.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
  }
  cb(null, true);
};

exports.upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

// Helper to check user permission on profile
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

exports.getProfilePictureData = async (req, res) => {
  const { id } = req.params;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to access this profile picture.' });
  }

  try {
    const [rows] = await pool.query('SELECT profile_picture FROM users WHERE user_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const picPath = rows[0].profile_picture;
    if (!picPath) return res.status(404).json({ message: 'No profile picture.' });
    
    // Normalize path to prevent path traversal
    const safeRelPath = picPath.replace(/^[/\\]+/, '');
    const absPath = path.resolve(__dirname, '..', safeRelPath);
    if (!absPath.startsWith(path.resolve(__dirname, '..', 'uploads'))) {
      return res.status(400).json({ message: 'Invalid file path.' });
    }

    if (!fs.existsSync(absPath)) return res.status(404).json({ message: 'File not found.' });
    const data = fs.readFileSync(absPath);
    const mime = picPath.endsWith('.png') ? 'image/png' : picPath.endsWith('.jpg') || picPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/webp';
    const base64 = `data:${mime};base64,${data.toString('base64')}`;
    return res.status(200).json({ profile_picture: base64 });
  } catch (error) {
    console.error('Get profile picture data error:', error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { id } = req.params;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to update this profile.' });
  }

  const { first_name, middle_initial, last_name, email, contact_number, purok } = req.body;

  try {
    // Check if email is already taken by another user
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

  // Security: only the authenticated user themselves can change their password
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

exports.uploadProfilePicture = async (req, res) => {
  const { id } = req.params;

  if (!canAccessProfile(req, id)) {
    return res.status(403).json({ message: 'Forbidden. You are not authorized to update this profile photo.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const profilePicturePath = `/uploads/profile-pictures/${req.file.filename}`;
    await pool.query('UPDATE users SET profile_picture = ? WHERE user_id = ?', [profilePicturePath, id]);
    return res.status(200).json({ message: 'Profile picture updated.', profile_picture: profilePicturePath });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * Module 1 Requirement: "The system must allow users to activate or deactivate their accounts, to ensure overall system security."
 */
exports.deactivateAccount = async (req, res) => {
  const { id } = req.params;
  const requesterId = Number(req.user?.user_id);
  const role = String(req.user?.role || '').toLowerCase();

  if (role !== 'admin' && requesterId !== Number(id)) {
    return res.status(403).json({ message: 'Forbidden. You can only deactivate your own account.' });
  }

  const { password, reason } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'Password confirmation is required to deactivate your account.' });
  }

  try {
    const [rows] = await pool.query('SELECT password_hash, first_name, last_name, role FROM users WHERE user_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Deactivation cancelled.' });
    }

    await pool.query(
      'UPDATE users SET status = ?, deactivation_reason = ? WHERE user_id = ?',
      ['inactive', reason || 'Self-deactivated by user', id]
    );

    // Notify administrators of deactivation
    try {
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
         VALUES (?, ?, 'account', FALSE, ?, NOW())`,
        [
          `Account Deactivated: ${user.first_name} ${user.last_name}`,
          `${user.first_name} ${user.last_name} (${(user.role || '').toUpperCase()}) has deactivated their account. Reason: ${reason || 'Not specified'}`,
          id,
        ]
      );
    } catch (_) {}

    return res.status(200).json({ message: 'Account deactivated successfully.' });
  } catch (error) {
    console.error('Deactivate account error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};