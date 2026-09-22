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
  filename: (req, file, cb) =>{
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user_${req.params.id}_${Date.now()}${ext}`);
  }
})

const fileFilter = (req, file, cb) => {
  if (!allowedMime.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
  }
  cb(null, true);
};

exports.upload = multer({storage, limits:{fileSize: 5* 1024 * 1024}, fileFilter});

exports.getProfile = async (req, res) => {
  const { id } = req.params;
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

// New: return profile picture as base64 to avoid CORP/CORS issues when frontend
exports.getProfilePictureData = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT profile_picture FROM users WHERE user_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const picPath = rows[0].profile_picture;
    if (!picPath) return res.status(404).json({ message: 'No profile picture.' });
    const absPath = path.join(__dirname, '..', picPath);
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
  const { first_name, middle_initial, last_name, email, contact_number, purok } = req.body;

  try {
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
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
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