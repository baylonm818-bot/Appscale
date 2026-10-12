const express = require('express');
const router = express.Router();
const { getAdminStats, getAdminNeedAttention, getNutritionAudit } = require('../controllers/dashboardControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/admin/stats', roleCheck(['admin']), getAdminStats);
router.get('/admin/need-attention', roleCheck(['admin']), getAdminNeedAttention);
router.get('/admin/nutrition-audit', roleCheck(['admin']), getNutritionAudit);

module.exports = router;