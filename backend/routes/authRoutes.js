const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, forgotPassword, verifyOtp, resetPassword, devLogin } = require('../controllers/authController');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 5, // 5 failed attempts per IP
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
// Development helper (disabled in production)
router.post('/dev-login', devLogin);

module.exports = router;

