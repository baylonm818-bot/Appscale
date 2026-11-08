const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getAdminNeedAttention,
  getNutritionAudit,
  getFeedingStats,
  getNutritionByYear,
} = require('../controllers/dashboardControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/admin/stats',           roleCheck(['admin']), getAdminStats);
router.get('/admin/need-attention',  roleCheck(['admin']), getAdminNeedAttention);
router.get('/admin/nutrition-audit', roleCheck(['admin']), getNutritionAudit);

// Step 10: feeding program stats + per-year nutrition view (admin only)
router.get('/admin/feeding-stats',      roleCheck(['admin']), getFeedingStats);
router.get('/admin/nutrition-by-year',  roleCheck(['admin']), getNutritionByYear);

module.exports = router;