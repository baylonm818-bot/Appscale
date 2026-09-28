const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getBhwStats } = require('../controllers/bhwDashboardControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/stats', getBhwStats);

module.exports = router;