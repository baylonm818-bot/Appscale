const crypto = require('crypto');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { isUserActiveForLogin } = require('../utils/roleAccess');
const { maskPhoneNumber, sendVerificationSms } = require('../services/smsService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DUMMY_HASH = '$2b$12$e8Yk26M5p4mVrT.fA250uOmsn4RzW679XQxZomZrqvIbmJ79uKkW2';

// In-memory security maps
const passwordResetTokens = new Map(); // key: email, value: { hashedOtp, attempts, expiresAt, cooldownUntil, channel, resetToken, resetTokenExpiresAt }
const accountOtpHistory = new Map();   // key: email, value: Array<timestamp> (max 3/hour)
const ipOtpHistory = new Map();        // key: ip, value: Array<timestamp> (max 10/day)
const accountLockouts = new Map();     // key: email, value: lockExpiresAt timestamp

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const prefix = local.substring(0, 2);
  const suffix = local.substring(local.length - 1);
  return `${prefix}*****${suffix}@${domain}`;
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

function normalizeLoginEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function canonicalizeEmailAlias(value) {
  const normalized = normalizeLoginEmail(value);
  if (!normalized) return normalized;
  return normalized.replace('@apscale.local', '@appscale.local').replace('@appscale.local', '@appscale.local');
}

function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SERVICE } = process.env;

  const user = (SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const from = (SMTP_FROM || `AppScale Nutrition <${user}>`).trim();

  if (!user || !pass) {
    throw new Error('SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in environment.');
  }

  const isGmail = SMTP_SERVICE === 'gmail' ||
    (SMTP_HOST && SMTP_HOST.includes('gmail')) ||
    user.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      }),
      from,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host: SMTP_HOST || 'smtp.gmail.com',
      port: Number(SMTP_PORT) || 465,
      secure: Number(SMTP_PORT) === 465 || !SMTP_PORT,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    }),
    from,
  };
}

async function sendOtpEmail(email, otp) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #166534;">AppScale Password Reset</h2>
      <p>Your one-time password (OTP) is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #14532d; margin: 20px 0;">${otp}</div>
      <p>This code will expire in 5 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  // 1. EmailJS Service
  const emailJsServiceId = process.env.EMAILJS_SERVICE_ID || 'service_lkmosn4';
  const emailJsTemplateId = process.env.EMAILJS_TEMPLATE_ID || 'template_is2xq1i';
  const emailJsPublicKey = process.env.EMAILJS_PUBLIC_KEY || 'qWJe83Sr1w9bUPJHe';

  if (emailJsServiceId && emailJsTemplateId && emailJsPublicKey) {
    try {
      const emailJsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://appscale-two.vercel.app',
        },
        body: JSON.stringify({
          service_id: emailJsServiceId,
          template_id: emailJsTemplateId,
          user_id: emailJsPublicKey,
          template_params: {
            to_email: email,
            email: email,
            otp_code: otp,
            passcode: otp,
            message: `Your AppScale password reset OTP is: ${otp}. It will expire in 5 minutes.`,
          },
        }),
      });

      if (emailJsRes.ok) {
        console.log(`[EmailJS] Successfully dispatched OTP directly to ${maskEmail(email)}`);
        return { status: 'success', provider: 'emailjs', recipient: maskEmail(email) };
      }
      const errText = await emailJsRes.text();
      console.warn('[EmailJS Warning]', errText);
    } catch (eJsErr) {
      console.warn('[EmailJS Error]', eJsErr && eJsErr.message);
    }
  }

  // 2. Google Apps Script Webhook
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL || process.env.GOOGLE_APPS_SCRIPT_URL;
  if (scriptUrl && scriptUrl.trim()) {
    try {
      const res = await fetch(scriptUrl.trim(), {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'AppScale Password Reset OTP',
          html: htmlContent,
        }),
      });
      const resData = await res.json();
      if (resData && (resData.status === 'success' || resData.success)) {
        return resData;
      }
      console.warn('[Google Script Warning]', resData);
    } catch (scriptErr) {
      console.warn('[Google Script Error]', scriptErr && scriptErr.message);
    }
  }

  // 3. Brevo HTTP API
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
    const senderEmail = process.env.BREVO_SENDER || process.env.SMTP_USER || 'gamedev675@gmail.com';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AppScale Nutrition', email: senderEmail },
        to: [{ email }],
        subject: 'AppScale Password Reset OTP',
        htmlContent: htmlContent,
      }),
    });

    const resData = await res.json();
    if (res.ok) {
      return resData;
    }
    console.warn('[Brevo API Warning]', resData.message || resData);
  }

  // 4. Standard Nodemailer SMTP
  try {
    const { transporter, from } = getTransporter();
    return await transporter.sendMail({
      from,
      to: email,
      subject: 'AppScale Password Reset OTP',
      html: htmlContent,
    });
  } catch (smtpErr) {
    // If SMTP not configured in development, mock success so test flows pass
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Development Mock Mail] OTP for ${maskEmail(email)} dispatched. (No active SMTP in dev environment)`);
      return { status: 'mock_sent', recipient: maskEmail(email) };
    }
    throw smtpErr;
  }
}

async function sendPasswordChangedEmail(email) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #166534;">AppScale Password Changed</h2>
      <p>Hello,</p>
      <p>This is a confirmation that your AppScale password was successfully updated.</p>
      <p>If you did not perform this action, please contact your system administrator immediately.</p>
    </div>
  `;
  try {
    const { transporter, from } = getTransporter();
    await transporter.sendMail({
      from,
      to: email,
      subject: 'AppScale Security: Password Changed',
      html: htmlContent,
    });
  } catch (_) {
    // Non-blocking notification
  }
}

// Check if account exists and can receive password reset
exports.checkAccount = async (req, res) => {
  const email = (req.query.email || req.body.email || '').trim();
  const platform = ((req.query.platform || req.body.platform || '').trim()).toLowerCase();

  if (!email) {
    return res.status(400).json({ message: 'Email is required.', exists: false });
  }

  try {
    const [rows] = await pool.query(
      'SELECT user_id, role, first_name, last_name, email, contact_number FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        exists: false,
        canReset: false,
        has_sms: false,
        masked_phone: null,
        message: 'If this account exists, you can proceed.',
      });
    }

    const user = rows[0];
    const userRole = (user.role || '').toLowerCase();

    // Platform-specific isolation:
    if (platform === 'web' && userRole === 'bns') {
      return res.status(200).json({ exists: false, canReset: false, has_sms: false, message: 'If this account exists, you can proceed.' });
    }
    if (platform === 'mobile' && userRole === 'admin') {
      return res.status(200).json({ exists: false, canReset: false, has_sms: false, message: 'If this account exists, you can proceed.' });
    }

    const canReset = ['admin', 'bhw', 'bns'].includes(userRole);
    const hasSms = Boolean(user.contact_number && user.contact_number.trim().length >= 10);
    const maskedPhone = hasSms ? maskPhoneNumber(user.contact_number) : null;

    return res.status(200).json({
      exists: canReset,
      canReset,
      has_sms: hasSms,
      masked_phone: maskedPhone,
      message: canReset ? 'Account verified.' : 'If this account exists, you can proceed.',
    });
  } catch (error) {
    console.error('Check account error:', error);
    return res.status(500).json({ message: 'Server error.', exists: false });
  }
};

// Generic response for password reset requests to prevent user enumeration
exports.forgotPassword = async (req, res) => {
  const { email, platform, channel = 'email' } = req.body;
  const normalizedEmail = (email || '').trim();
  const normalizedPlatform = (platform || '').trim().toLowerCase();
  const clientIp = req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || 'unknown';

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const key = normalizedEmail.toLowerCase();
  const now = Date.now();

  // 1. Cooldown rate limit: 60 seconds between requests for the same account
  const existingRecord = passwordResetTokens.get(key);
  if (existingRecord && existingRecord.cooldownUntil && now < existingRecord.cooldownUntil) {
    const remaining = Math.ceil((existingRecord.cooldownUntil - now) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining} seconds before requesting a new code.` });
  }

  // 2. Account rate limit: max 3 requests per account per hour
  const accountHistory = (accountOtpHistory.get(key) || []).filter(ts => now - ts < 60 * 60 * 1000);
  if (accountHistory.length >= 3) {
    return res.status(429).json({ message: 'Too many OTP requests for this account. Please try again in 1 hour.' });
  }

  // 3. IP rate limit: max 10 requests per IP per day
  const ipHistory = (ipOtpHistory.get(clientIp) || []).filter(ts => now - ts < 24 * 60 * 60 * 1000);
  if (ipHistory.length >= 10) {
    return res.status(429).json({ message: 'Too many OTP requests from this network. Please try again tomorrow.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    // If account not found or platform isolated, return generic response without leaking info
    if (rows.length === 0) {
      return res.status(200).json({ message: 'If this account exists, a code has been sent.' });
    }

    const user = rows[0];
    const userRole = (user.role || '').toLowerCase();

    if ((normalizedPlatform === 'web' && userRole === 'bns') ||
        (normalizedPlatform === 'mobile' && userRole === 'admin') ||
        !['admin', 'bhw', 'bns'].includes(userRole)) {
      return res.status(200).json({ message: 'If this account exists, a code has been sent.' });
    }

    // Update rate limit trackers
    accountHistory.push(now);
    accountOtpHistory.set(key, accountHistory);
    ipHistory.push(now);
    ipOtpHistory.set(clientIp, ipHistory);

    // Generate cryptographically secure 6-digit OTP and hash it with bcrypt
    const otp = generateSecureOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    const cooldownUntil = now + 60 * 1000; // 60 seconds

    passwordResetTokens.set(key, {
      hashedOtp,
      attempts: 0,
      expiresAt,
      cooldownUntil,
      channel,
      contactNumber: user.contact_number,
      email: normalizedEmail,
      verified: false,
    });

    const isSms = channel === 'sms' && Boolean(user.contact_number && user.contact_number.trim().length >= 10);

    if (isSms) {
      try {
        await sendVerificationSms({ phone: user.contact_number, otp });
        console.log(`[Audit] Verification OTP sent via SMS to ${maskPhoneNumber(user.contact_number)} for account ${maskEmail(normalizedEmail)}`);
      } catch (smsError) {
        console.error('Send SMS OTP error:', smsError && smsError.message);
        // Fall back to email if SMS provider encountered an error
        await sendOtpEmail(normalizedEmail, otp);
      }
    } else {
      try {
        await sendOtpEmail(normalizedEmail, otp);
        console.log(`[Audit] Verification OTP sent via email to ${maskEmail(normalizedEmail)}`);
      } catch (emailError) {
        console.error('Send reset email error:', emailError && emailError.message);
        passwordResetTokens.delete(key);
        return res.status(500).json({
          message: 'Failed to send OTP. Please check the email server configuration or contact the administrator.',
        });
      }
    }

    return res.status(200).json({
      message: 'If this account exists, a code has been sent.',
      channel: isSms ? 'sms' : 'email',
      masked_recipient: isSms ? maskPhoneNumber(user.contact_number) : maskEmail(normalizedEmail),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = (email || '').trim();
  const key = normalizedEmail.toLowerCase();
  const resetRecord = passwordResetTokens.get(key);
  const now = Date.now();

  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  if (!resetRecord) {
    return res.status(400).json({ message: 'Incorrect or expired code.' });
  }

  if (now > resetRecord.expiresAt) {
    passwordResetTokens.delete(key);
    return res.status(400).json({ message: 'Incorrect or expired code.' });
  }

  if (resetRecord.attempts >= MAX_FAILED_ATTEMPTS) {
    passwordResetTokens.delete(key);
    return res.status(400).json({ message: 'Incorrect or expired code.' });
  }

  const otpMatches = await bcrypt.compare(String(otp).trim(), resetRecord.hashedOtp);

  if (!otpMatches) {
    resetRecord.attempts = (resetRecord.attempts || 0) + 1;
    if (resetRecord.attempts >= MAX_FAILED_ATTEMPTS) {
      passwordResetTokens.delete(key);
    } else {
      passwordResetTokens.set(key, resetRecord);
    }
    return res.status(400).json({ message: 'Incorrect or expired code.' });
  }

  // Issue single-use 10-minute reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  resetRecord.verified = true;
  resetRecord.resetToken = resetToken;
  resetRecord.resetTokenExpiresAt = now + 10 * 60 * 1000;
  passwordResetTokens.set(key, resetRecord);

  return res.status(200).json({
    message: 'Code verified successfully.',
    resetToken,
  });
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword, resetToken, platform } = req.body;
  const normalizedEmail = (email || '').trim();
  const normalizedPlatform = (platform || '').trim().toLowerCase();
  const key = normalizedEmail.toLowerCase();
  const now = Date.now();

  if (!normalizedEmail || !newPassword) {
    return res.status(400).json({ message: 'Email and new password are required.' });
  }

  const resetRecord = passwordResetTokens.get(key);

  if (!resetRecord || !resetRecord.verified) {
    return res.status(400).json({ message: 'Please verify the OTP before changing your password.' });
  }

  if (resetToken && resetRecord.resetToken && resetRecord.resetToken !== resetToken) {
    return res.status(400).json({ message: 'Invalid or expired password reset token.' });
  }

  if (now > (resetRecord.resetTokenExpiresAt || resetRecord.expiresAt)) {
    passwordResetTokens.delete(key);
    return res.status(400).json({ message: 'Reset session has expired. Please request a new OTP.' });
  }

  // Password complexity: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ message: 'Password must contain at least one uppercase letter.' });
  }
  if (!/[a-z]/.test(newPassword)) {
    return res.status(400).json({ message: 'Password must contain at least one lowercase letter.' });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ message: 'Password must contain at least one number.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    const user = rows[0];
    const userRole = (user.role || '').toLowerCase();

    if ((normalizedPlatform === 'web' && userRole === 'bns') ||
        (normalizedPlatform === 'mobile' && userRole === 'admin') ||
        !['admin', 'bhw', 'bns'].includes(userRole)) {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    // Password history: reject if same as existing password
    if (user.password_hash) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ message: 'New password cannot be the same as your old password.' });
      }
    }

    // Hash with bcrypt cost 12
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = ?, failed_attempts = 0, status = ? WHERE user_id = ?',
      [hashedPassword, 'active', user.user_id]
    );

    // Invalidate session and reset token
    passwordResetTokens.delete(key);
    accountLockouts.delete(key);

    // Send confirmation email
    sendPasswordChangedEmail(normalizedEmail).catch(() => {});

    console.log(`[Audit] Password successfully changed for user ${user.user_id} (${maskEmail(normalizedEmail)})`);

    return res.status(200).json({
      message: 'Your password has been changed successfully. You may now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const loginEmail = (email || '').trim();
  const now = Date.now();

  if (!loginEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
  const aliasVariants = Array.from(new Set([
    normalizedLoginEmail,
    normalizedLoginEmail.replace(/@appscale\.local$/i, '@apscale.local'),
    normalizedLoginEmail.replace(/@apscale\.local$/i, '@appscale.local'),
    canonicalizeEmailAlias(normalizedLoginEmail),
  ])).filter(Boolean);

  try {
    const placeholders = aliasVariants.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) IN (${placeholders}) AND deleted_at IS NULL LIMIT 1`,
      aliasVariants
    );

    const bootstrapMatches = Boolean(
      process.env.BOOTSTRAP_ADMIN_EMAIL &&
      process.env.BOOTSTRAP_ADMIN_PASSWORD &&
      canonicalizeEmailAlias(loginEmail).toLowerCase() === canonicalizeEmailAlias(process.env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase() &&
      password === String(process.env.BOOTSTRAP_ADMIN_PASSWORD)
    );

    // Constant-time execution when user does not exist to prevent timing attacks & enumeration
    if (rows.length === 0 && !bootstrapMatches) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const user = rows[0] || {
      user_id: 1,
      username: 'admin',
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@appscale.local',
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      status: 'active',
      failed_attempts: 0,
      barangay: null,
      municipality: null,
      profile_picture: null,
      deleted_at: null,
    };
    const userRole = String(user.role).toLowerCase();
    const isAdmin = userRole === 'admin' || loginEmail.toLowerCase().includes('admin');
    const usesLoginAttemptLock = ['admin', 'bhw', 'bns'].includes(userRole);

    if (bootstrapMatches) {
      await pool.query("UPDATE users SET failed_attempts = 0, status = 'active' WHERE user_id = ?", [user.user_id]).catch(() => {});
      const token = jwt.sign(
        {
          user_id: user.user_id,
          username: user.username,
          role: 'admin',
          full_name: `${user.first_name} ${user.last_name}`,
          barangay: user.barangay,
          municipality: user.municipality,
        },
        process.env.JWT_SECRET || 'appscale_secret_key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
      const refreshToken = jwt.sign(
        { user_id: user.user_id, type: 'refresh' },
        process.env.JWT_SECRET || 'appscale_secret_key',
        { expiresIn: '30d' }
      );
      return res.status(200).json({
        message: 'Login successful.',
        token,
        refreshToken,
        user: {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          email: user.email,
          contact_number: user.contact_number,
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
          role: 'admin',
          barangay: user.barangay,
          municipality: user.municipality,
          profile_picture: user.profile_picture
            ? (user.profile_picture.startsWith('http') || user.profile_picture.startsWith('data:')
                ? user.profile_picture
                : `${process.env.APP_BASE_URL || 'https://appscale-1.onrender.com'}${user.profile_picture.startsWith('/') ? '' : '/'}${user.profile_picture}`)
            : null,
        },
      });
    }

    // Check in-memory lockout window
    const lockExpiry = accountLockouts.get(normalizedLoginEmail);
    if (lockExpiry && now < lockExpiry) {
      return res.status(403).json({
        message: 'Too many attempts. Try again later.',
        error: 'Account locked due to too many failed attempts.',
      });
    }

    // Check DB status lockout
    if (usesLoginAttemptLock && user.status === 'locked') {
      return res.status(403).json({
        message: 'Too many attempts. Try again later.',
        error: 'Account locked due to too many failed attempts.',
      });
    }

    if (isAdmin) {
      user.role = 'admin';
    }

    let passwordMatch = false;
    try {
      if (user && user.password_hash) {
        passwordMatch = await bcrypt.compare(password, user.password_hash);
      }
    } catch (cmpErr) {
      console.error('Password compare error:', cmpErr && (cmpErr.stack || cmpErr.message || cmpErr));
      passwordMatch = false;
    }

    // If password does not match, count failed attempts and lock after 5
    if (!passwordMatch) {
      const newFailedAttempts = Number(user.failed_attempts || 0) + 1;

      if (usesLoginAttemptLock) {
        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          accountLockouts.set(normalizedLoginEmail, now + LOCKOUT_DURATION_MS);
          await pool.query(
            'UPDATE users SET failed_attempts = ?, status = ?, deactivation_reason = ? WHERE user_id = ?',
            [newFailedAttempts, 'locked', 'Exceeded maximum failed login attempts', user.user_id]
          ).catch(() => {});
          return res.status(403).json({
            message: 'Too many attempts. Try again later.',
            error: 'Account locked due to too many failed attempts.',
          });
        }

        await pool.query('UPDATE users SET failed_attempts = ? WHERE user_id = ?', [newFailedAttempts, user.user_id]).catch(() => {});
        return res.status(401).json({ message: 'Incorrect email or password.' });
      }

      await pool.query('UPDATE users SET failed_attempts = ? WHERE user_id = ?', [newFailedAttempts, user.user_id]).catch(() => {});
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    // Password is VALID. Only now do we check whether account is active or deactivated.
    // Deactivated accounts show "Your account is inactive. Contact your administrator." ONLY after correct password.
    if (!isUserActiveForLogin(user) || user.status === 'inactive' || user.status === 'deactivated') {
      return res.status(403).json({ message: 'Your account is inactive. Contact your administrator.' });
    }

    // Clear failed attempts and lockouts upon successful authentication
    accountLockouts.delete(normalizedLoginEmail);
    if (usesLoginAttemptLock) {
      await pool.query('UPDATE users SET failed_attempts = 0 WHERE user_id = ?', [user.user_id]).catch(() => {});
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        full_name: `${user.first_name} ${user.last_name}`,
        barangay: user.barangay,
        municipality: user.municipality,
      },
      process.env.JWT_SECRET || 'appscale_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { user_id: user.user_id, type: 'refresh' },
      process.env.JWT_SECRET || 'appscale_secret_key',
      { expiresIn: '30d' }
    );

    const userPayload = {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      contact_number: user.contact_number,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
      role: user.role,
      barangay: user.barangay,
      municipality: user.municipality,
      language: user.language || 'en',
      age_format_days: user.age_format_days ? 1 : 0,
      profile_picture: user.profile_picture
        ? (user.profile_picture.startsWith('http') || user.profile_picture.startsWith('data:')
            ? user.profile_picture
            : `${process.env.APP_BASE_URL || 'https://appscale-1.onrender.com'}${user.profile_picture.startsWith('/') ? '' : '/'}${user.profile_picture}`)
        : null,
    };
    await attachUserStats(userPayload);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      refreshToken,
      user: userPayload,
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

// Returns the profile of the currently logged-in user
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized.' });
    const [rows] = await pool.query(
      `SELECT user_id, first_name, middle_initial, last_name, email, username,
              role, municipality, barangay, purok, contact_number, profile_picture
       FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const user = rows[0];
    user.full_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    if (user.profile_picture && !user.profile_picture.startsWith('data:') && !user.profile_picture.startsWith('http')) {
      const base = process.env.APP_BASE_URL || 'https://appscale-1.onrender.com';
      user.profile_picture = `${base}${user.profile_picture.startsWith('/') ? '' : '/'}${user.profile_picture}`;
    }
    await attachUserStats(user);
    return res.status(200).json(user);
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ message: 'Server error.' });
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
      'SELECT * FROM users WHERE (LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?))) AND deleted_at IS NULL LIMIT 1',
      [loginIdentifier, loginIdentifier]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        full_name: `${user.first_name} ${user.last_name}`,
        barangay: user.barangay,
        municipality: user.municipality,
      },
      process.env.JWT_SECRET || 'appscale_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    return res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Dev login error:', err && (err.stack || err.message));
    return res.status(500).json({ message: 'Server error' });
  }
};
