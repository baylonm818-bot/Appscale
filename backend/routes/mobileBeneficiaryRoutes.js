const express = require('express');
const router = express.Router();
const {
  upsertChild,
  upsertMother,
  syncNutritionRecord,
  getMobileChildren,
  getMobileMothers,
  getMobileSchedules,
  createMobileSchedule,
} = require('../controllers/mobileBeneficiaryControllers');

router.post('/children', upsertChild);
router.post('/mothers', upsertMother);
router.post('/nutrition-records', syncNutritionRecord);
router.post('/schedules', createMobileSchedule);

router.get('/children', getMobileChildren);
router.get('/mothers', getMobileMothers);
router.get('/schedules', getMobileSchedules);

module.exports = router;