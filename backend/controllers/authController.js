const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { isUserActiveForLogin } = require('../utils/roleAccess');

const MAX_FAILED_ATTEMPTS = 5;
const passwordResetTokens = new Map();

function normalizeLoginEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function canonicalizeEmailAlias(value) {
  const normalized = normalizeLoginEmail(value);
  if (!normalized) return normalized;
  return normalized.replace('@apscale.local', '@appscale.local').replace('@appscale.local', '@appscale.local');
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SERVICE } = process.env;

  const user = (SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const from = (SMTP_FROM || `AppScale Nutrition <${user}>`).trim();

  if (!user || !pass) {
    throw new Error('SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in environment.');
  }

  // Use Gmail service if Gmail user or host specified (handles ports/SSL automatically)
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
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  // 1. EmailJS Service (Direct Gmail delivery via Port 443 HTTPS - sends to ANY recipient without domain restriction)
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
            message: `Your AppScale password reset OTP is: ${otp}. It will expire in 10 minutes.`,
          },
        }),
      });

      if (emailJsRes.ok) {
        console.log(`[EmailJS] Successfully dispatched OTP directly to ${email}`);
        return { status: 'success', provider: 'emailjs', recipient: email };
      }
      const errText = await emailJsRes.text();
      console.warn('[EmailJS Warning]', errText);
    } catch (eJsErr) {
      console.warn('[EmailJS Error]', eJsErr && eJsErr.message);
    }
  }

  // 2. If GOOGLE_SCRIPT_URL is provided, use Google Apps Script Webhook (Port 443 HTTPS - sends to ANY email in the world directly via user's Gmail without domain/IP blocks)
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

  // 2. If BREVO_API_KEY is provided, use Brevo HTTP API (Port 443 HTTPS - supports any recipient without domain verification)
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

  // 3. If RESEND_API_KEY is provided, use Resend HTTP API (Port 443 HTTPS - bypasses Render SMTP port blocks)
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    const fromAddress = process.env.RESEND_FROM || 'AppScale <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'AppScale Password Reset OTP',
        html: htmlContent,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      const errMsg = (resData.message || (resData.error && resData.error.message) || '').toLowerCase();
      // If Resend free tier sandbox restricts delivery to verified owner email:
      if (errMsg.includes('only send testing emails') || errMsg.includes('testing emails') || errMsg.includes('verify a domain')) {
        const ownerEmail = process.env.SMTP_USER || 'gamedev675@gmail.com';
        console.warn(`[Resend Sandbox] Forwarding OTP for ${email} to verified owner ${ownerEmail}`);

        const forwardHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
              <strong>AppScale Sandbox Testing Notice:</strong><br>
              Password Reset OTP was requested for account: <b>${email}</b>.<br>
              (Delivered to verified owner email for testing).
            </div>
            <h2 style="color: #166534;">AppScale Password Reset</h2>
            <p>The one-time password (OTP) for <b>${email}</b> is:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #14532d; margin: 20px 0;">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
          </div>
        `;

        const fallbackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [ownerEmail],
            subject: `[AppScale OTP for ${email}] Password Reset OTP`,
            html: forwardHtml,
          }),
        });

        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok) {
          throw new Error(fallbackData.message || (fallbackData.error && fallbackData.error.message) || 'Resend sandbox fallback failed');
        }
        return fallbackData;
      }
      throw new Error(resData.message || (resData.error && resData.error.message) || 'Resend HTTP API error');
    }
    return resData;
  }

  // 2. Otherwise use standard Nodemailer SMTP (Works on local and non-restricted cloud servers)
  const { transporter, from } = getTransporter();

  return transporter.sendMail({
    from,
    to: email,
    subject: 'AppScale Password Reset OTP',
    html: htmlContent,
  });
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
      'SELECT user_id, role, first_name, last_name, email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted_at IS NULL LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(200).json({ exists: false, canReset: false, message: 'Unknown account.' });
    }

    const user = rows[0];
    const userRole = (user.role || '').toLowerCase();

    // Platform-specific isolation:
    // Web: only web accounts (admin, bhw) are recognized. BNS is mobile-only -> "Unknown account."
    if (platform === 'web' && userRole === 'bns') {
      return res.status(200).json({ exists: false, canReset: false, message: 'Unknown account.' });
    }

    // Mobile: only mobile accounts (bns, bhw) are recognized. Admin is web-only -> "Unknown account."
    if (platform === 'mobile' && userRole === 'admin') {
      return res.status(200).json({ exists: false, canReset: false, message: 'Unknown account.' });
    }

    const canReset = ['admin', 'bhw', 'bns'].includes(userRole);

    return res.status(200).json({
      exists: canReset,
      canReset,
      message: canReset ? 'Account verified.' : 'Unknown account.'
    });
  } catch (error) {
    console.error('Check account error:', error);
    return res.status(500).json({ message: 'Server error.', exists: false });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email, platform } = req.body;
  const normalizedEmail = (email || '').trim();
  const normalizedPlatform = (platform || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required.' });
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

    // Platform-specific isolation:
    // Web: only web accounts (admin, bhw) are recognized. BNS is mobile-only -> "Unknown account."
    if (normalizedPlatform === 'web' && userRole === 'bns') {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    // Mobile: only mobile accounts (bns, bhw) are recognized. Admin is web-only -> "Unknown account."
    if (normalizedPlatform === 'mobile' && userRole === 'admin') {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    if (!['admin', 'bhw', 'bns'].includes(userRole)) {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    passwordResetTokens.set(normalizedEmail.toLowerCase(), { otp, expiresAt });

    try {
      await sendOtpEmail(normalizedEmail, otp);
      return res.status(200).json({
        message: 'An OTP has been sent to your email. Please check your inbox.',
      });
    } catch (emailError) {
      console.error('Send reset email error (SMTP issue):', emailError && emailError.message);
      // Delete token since email delivery failed; never expose OTP in API response
      passwordResetTokens.delete(normalizedEmail.toLowerCase());
      return res.status(500).json({
        message: 'Failed to send OTP to your email. Please check the email server configuration or contact the administrator.',
        reason: emailError && emailError.message ? emailError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword, platform } = req.body;
  const normalizedEmail = (email || '').trim();
  const normalizedPlatform = (platform || '').trim().toLowerCase();

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
      return res.status(404).json({ message: 'Unknown account.' });
    }

    const user = rows[0];
    const userRole = (user.role || '').toLowerCase();

    if (normalizedPlatform === 'web' && userRole === 'bns') {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    if (normalizedPlatform === 'mobile' && userRole === 'admin') {
      return res.status(404).json({ message: 'Unknown account.' });
    }

    if (!['admin', 'bhw', 'bns'].includes(userRole)) {
      return res.status(404).json({ message: 'Unknown account.' });
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

  const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
  const aliasVariants = Array.from(new Set([
    normalizedLoginEmail,
    normalizedLoginEmail.replace(/@appscale\.local$/i, '@apscale.local'),
    normalizedLoginEmail.replace(/@apscale\.local$/i, '@appscale.local'),
    canonicalizeEmailAlias(normalizedLoginEmail),
  ])).filter(Boolean);

  console.log('Login attempt for:', loginEmail, 'Variants:', aliasVariants);

  try {
    const placeholders = aliasVariants.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) IN (${placeholders}) AND deleted_at IS NULL LIMIT 1`,
      aliasVariants
    );

    console.log('DB returned rows:', rows && rows.length);

    const bootstrapMatches = Boolean(
      process.env.BOOTSTRAP_ADMIN_EMAIL &&
      process.env.BOOTSTRAP_ADMIN_PASSWORD &&
      canonicalizeEmailAlias(loginEmail).toLowerCase() === canonicalizeEmailAlias(process.env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase() &&
      password === String(process.env.BOOTSTRAP_ADMIN_PASSWORD)
    );

    if (rows.length === 0 && !bootstrapMatches) {
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
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      return res.status(200).json({
        message: 'Login successful.',
        token,
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

    if (usesLoginAttemptLock && user.status === 'locked') {
      return res.status(403).json({ message: 'Account is locked. Please contact the administrator.' });
    }

    if (!isUserActiveForLogin(user)) {
      return res.status(403).json({ message: 'Account is inactive. Please contact the administrator.' });
    }

    if (isAdmin) {
      user.role = 'admin';
    }

    let passwordMatch = false;
    try {
      if (user && user.password_hash) {
        passwordMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        passwordMatch = false;
      }
    } catch (cmpErr) {
      console.error('Password compare error:', cmpErr && (cmpErr.stack || cmpErr.message || cmpErr));
      passwordMatch = false;
    }

    if (!passwordMatch) {
      const newFailedAttempts = Number(user.failed_attempts || 0) + 1;

      if (usesLoginAttemptLock) {
        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          await pool.query(
            'UPDATE users SET failed_attempts = ?, status = ?, deactivation_reason = ? WHERE user_id = ?',
            [newFailedAttempts, 'locked', 'Exceeded maximum failed login attempts', user.user_id]
          );
          return res.status(403).json({ message: 'Account locked due to too many failed attempts.' });
        }

        // Return plain invalid/incorrect credentials message without rate limit timer or countdown
        await pool.query('UPDATE users SET failed_attempts = ? WHERE user_id = ?', [newFailedAttempts, user.user_id]);
        return res.status(401).json({ message: 'Incorrect email or password.' });
      }

      // Non-locked roles
      await pool.query('UPDATE users SET failed_attempts = ? WHERE user_id = ?', [newFailedAttempts, user.user_id]);
      return res.status(401).json({ message: 'Incorrect email or password.' });
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
        barangay: user.barangay,
        municipality: user.municipality,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
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
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    return res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Dev login error:', err && (err.stack || err.message));
    return res.status(500).json({ message: 'Server error' });
  }
};