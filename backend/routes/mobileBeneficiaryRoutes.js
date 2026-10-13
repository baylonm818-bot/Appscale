const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  upsertChild,
  upsertMother,
  syncNutritionRecord,
  updateNutritionRecord,
  deleteNutritionRecord,
  getMobileChildren,
  getMobileMothers,
  getMobileSchedules,
  createMobileSchedule,
  getMobileNutritionRecords,
  getMobileSync,
  upsertProgramEnrollment,
  unenrollProgramBeneficiary,
  getEnrollmentHistory,
  blockHardDeleteEnrollment,
  getMobileProgramEnrollments,
  upsertMealPlan,
  getMobileMealPlans,
  recordFeedingAttendance,
  getMobileFeedingAttendance,
  upsertFeedingSchedule,
  getMobileFeedingSchedule,
  recordChildService,
  getMobileChildServices,
  recordMotherService,
  getMobileMotherServices,
} = require('../controllers/mobileBeneficiaryControllers');
const { transferBeneficiary, getBarangays, checkDuplicate } = require('../controllers/masterlistControllers');

// Mobile app users are BNS/BHW — enforce role (allow admin for server-side syncs)
router.use(roleCheck(['bhw', 'bns', 'admin']));

router.post('/children', upsertChild);
router.post('/mothers', upsertMother);
router.post('/nutrition-records', syncNutritionRecord);
router.put('/nutrition-records', updateNutritionRecord);
router.delete('/nutrition-records', deleteNutritionRecord);
router.post('/schedules', createMobileSchedule);
router.post('/transfer', transferBeneficiary);

// Programs & Services endpoints
router.post('/program-enrollments', upsertProgramEnrollment);
router.post('/program-enrollments/unenroll', unenrollProgramBeneficiary);
router.get('/program-enrollments/history', getEnrollmentHistory);
router.delete('/program-enrollments/:id', blockHardDeleteEnrollment);
router.delete('/program-enrollments', blockHardDeleteEnrollment);
router.get('/program-enrollments', getMobileProgramEnrollments);

router.post('/meal-plans', upsertMealPlan);
router.get('/meal-plans', getMobileMealPlans);

router.post('/feeding-attendance', recordFeedingAttendance);
router.get('/feeding-attendance', getMobileFeedingAttendance);

router.post('/feeding-schedules', upsertFeedingSchedule);
router.get('/feeding-schedules', getMobileFeedingSchedule);

router.post('/child-services', recordChildService);
router.get('/child-services', getMobileChildServices);

router.post('/mother-services', recordMotherService);
router.get('/mother-services', getMobileMotherServices);

router.get('/children', getMobileChildren);
router.get('/mothers', getMobileMothers);
router.get('/schedules', getMobileSchedules);
router.get('/nutrition-records', getMobileNutritionRecords);
router.get('/sync', getMobileSync);
router.get('/barangays', getBarangays);
router.get('/check-duplicate', checkDuplicate);

module.exports = router;