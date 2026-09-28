const express = require('express');
const router = express.Router();
const { login, forgotPassword, verifyOtp, resetPassword, devLogin } = require('../controllers/authController');

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
// Development helper (disabled in production)
router.post('/dev-login', devLogin);

module.exports = router;

