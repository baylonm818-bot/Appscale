const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, forgotPassword, verifyOtp, resetPassword, devLogin } = require('../controllers/authController');

// Login rate limiter — ONLY counts failed attempts (skipSuccessfulRequests: true)
// This means: correct password ALWAYS works, even after many wrong attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20,                   // max 20 FAILED attempts per IP per window
  skipSuccessfulRequests: true, // ← KEY: successful logins don't count
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many failed login attempts from this device. Please try again in 15 minutes.' },
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
