const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, forgotPassword, verifyOtp, resetPassword, devLogin } = require('../controllers/authController');
const { buildLoginLimiterKey } = require('../utils/authRateLimit');

// Login rate limiter — count failed attempts by email/account instead of a shared IP.
// This prevents one user from poisoning another user's login flow behind a shared network.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildLoginLimiterKey(req),
  message: { message: 'Too many failed login attempts for this account. Please try again in 15 minutes.' },
});

// OTP brute-force protection: max 10 attempts per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP attempts. Please try again in 15 minutes.' },
});

router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/reset-password', resetPassword);
// Development helper (disabled in production)
router.post('/dev-login', devLogin);

module.exports = router;
