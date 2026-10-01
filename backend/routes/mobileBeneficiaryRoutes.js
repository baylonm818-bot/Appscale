const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  upsertChild,
  upsertMother,
  syncNutritionRecord,
  getMobileChildren,
  getMobileMothers,
  getMobileSchedules,
  createMobileSchedule,
} = require('../controllers/mobileBeneficiaryControllers');

// Mobile app users are BNS/BHW — enforce role (allow admin for server-side syncs)
router.use(roleCheck(['bhw', 'bns', 'admin']));

router.post('/children', upsertChild);
router.post('/mothers', upsertMother);
router.post('/nutrition-records', syncNutritionRecord);
router.post('/schedules', createMobileSchedule);

router.get('/children', getMobileChildren);
router.get('/mothers', getMobileMothers);
router.get('/schedules', getMobileSchedules);

module.exports = router;