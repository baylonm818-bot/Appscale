const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getBhwStats } = require('../controllers/bhwDashboardControllers');

// BHW/BNS and Admin
router.use(roleCheck(['bhw', 'bns', 'admin']));

router.get('/stats', getBhwStats);

module.exports = router;