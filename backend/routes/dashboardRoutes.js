const express = require('express');
const router = express.Router();
const { getAdminStats, getAdminNeedAttention } = require('../controllers/dashboardControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/admin/stats', roleCheck(['admin']), getAdminStats);
router.get('/admin/need-attention', roleCheck(['admin']), getAdminNeedAttention);

module.exports = router;