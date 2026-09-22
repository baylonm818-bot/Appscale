const express = require('express');
const router = express.Router();
const { getAdminStats, getAdminNeedAttention } = require('../controllers/dashboardControllers');

router.get('/admin/stats', getAdminStats);
router.get('/admin/need-attention', getAdminNeedAttention);

module.exports = router;