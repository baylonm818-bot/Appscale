const express = require('express');
const router = express.Router();
const { getBhwStats } = require('../controllers/bhwDashboardControllers');

router.get('/stats', getBhwStats);

module.exports = router;