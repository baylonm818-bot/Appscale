const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getSystemLogs } = require('../controllers/adminLogControllers');

// Admin-only: read system logs
router.get('/logs', roleCheck(['admin']), getSystemLogs);

module.exports = router;
