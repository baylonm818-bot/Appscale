const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const MAX_FAILED_ATTEMPTS = 3;
const passwordResetTokens = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error('SMTP configuration is missing. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in the backend environment.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendOtpEmail(email, otp) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'AppScale Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #166534;">AppScale Password Reset</h2>
        <p>Your one-time password (OTP) is:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #14532d; margin: 20px 0;">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = (email || '').trim();

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    const user = rows[0];
    console.log('Selected user for login:', user.user_id, user.role);

    if (!['admin', 'bhw'].includes(user.role)) {
      return res.status(403).json({ message: 'Password reset is only available for admin and BHW accounts.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    passwordResetTokens.set(normalizedEmail.toLowerCase(), { otp, expiresAt });

    try {
      await sendOtpEmail(normalizedEmail, otp);
      return res.status(200).json({
        message: 'An OTP has been sent to your email. Please use it to set your new password.',
      });
    } catch (emailError) {
      passwordResetTokens.delete(normalizedEmail.toLowerCase());
      console.error('Send reset email error:', emailError);
      return res.status(500).json({ message: 'Unable to send reset email. Please check the SMTP settings.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  const normalizedEmail = (email || '').trim();

  if (!normalizedEmail || !newPassword) {
    return res.status(400).json({ message: 'Email and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
  }

  const key = normalizedEmail.toLowerCase();
  const resetRecord = passwordResetTokens.get(key);

  if (!resetRecord || !resetRecord.verified) {
    return res.status(400).json({ message: 'Please verify the OTP before changing your password.' });
  }

  if (Date.now() > resetRecord.expiresAt) {
    passwordResetTokens.delete(key);
    return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    const user = rows[0];

    if (!['admin', 'bhw'].includes(user.role)) {
      return res.status(403).json({ message: 'Password reset is only available for admin and BHW accounts.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = ?, failed_attempts = 0, status = ? WHERE user_id = ?',
      [hashedPassword, 'active', user.user_id]
    );

    passwordResetTokens.delete(key);

    return res.status(200).json({
      message: 'Password reset successful. You may now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = (email || '').trim();
  const key = normalizedEmail.toLowerCase();
  const resetRecord = passwordResetTokens.get(key);

  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  if (!resetRecord) {
    return res.status(400).json({ message: 'No reset request found for this email.' });
  }

  if (Date.now() > resetRecord.expiresAt) {
    passwordResetTokens.delete(key);
    return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
  }

  if (resetRecord.otp !== String(otp).trim()) {
    return res.status(400).json({ message: 'Invalid OTP code.' });
  }

  resetRecord.verified = true;
  passwordResetTokens.set(key, resetRecord);

  return res.status(200).json({ message: 'OTP verified. You can now create a new password.' });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const loginEmail = (email || '').trim();

  if (!loginEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  console.log('Login attempt for:', loginEmail);

  try {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1`,
      [loginEmail]
    );

    console.log('DB returned rows:', rows && rows.length);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const userRole = String(user.role).toLowerCase();
    const isAdmin = userRole === 'admin';
    const usesLoginAttemptLock = ['bhw', 'bns'].includes(userRole);

    if (usesLoginAttemptLock && user.status === 'locked') {
      return res.status(403).json({ message: 'Account is locked. Please contact the administrator.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Please contact the administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      if (isAdmin) {
        // Admin accounts are never locked — just return a generic invalid credentials message.
        return res.status(401).json({ message: 'Invalid username/email or password.' });
      }

      const newFailedAttempts = Number(user.failed_attempts || 0) + 1;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        await pool.query(
          'UPDATE users SET failed_attempts = ?, status = ?, deactivation_reason = ? WHERE user_id = ?',
          [newFailedAttempts, 'locked', 'Exceeded maximum failed login attempts', user.user_id]
        );
        return res.status(403).json({ message: 'Account locked due to too many failed attempts.' });
      } else {
        await pool.query(
          'UPDATE users SET failed_attempts = ? WHERE user_id = ?',
          [newFailedAttempts, user.user_id]
        );
        return res.status(401).json({
          message: `Invalid email or password. ${MAX_FAILED_ATTEMPTS - newFailedAttempts} attempt(s) remaining.`,
        });
      }
    }

    if (usesLoginAttemptLock) {
      await pool.query('UPDATE users SET failed_attempts = 0 WHERE user_id = ?', [user.user_id]);
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        full_name: `${user.first_name} ${user.last_name}`,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        full_name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        barangay: user.barangay,
        municipality: user.municipality,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error('Login error:', error && (error.stack || error.message || error));
    if (error && error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(503).json({ message: 'Database access denied. Check DB credentials in backend/.env.' });
    }
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ message: 'Server error. See error for details.', error: error && (error.stack || error.message) });
    }
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// Development-only login helper: bypasses some lock logic for quick testing
exports.devLogin = async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ message: 'Not found' });
  const { email, username, password } = req.body;
  const loginIdentifier = (email || username || '').trim();
  if (!loginIdentifier || !password) return res.status(400).json({ message: 'Identifier and password required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [loginIdentifier, loginIdentifier]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    return res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Dev login error:', err && (err.stack || err.message));
    return res.status(500).json({ message: 'Server error' });
  }
};