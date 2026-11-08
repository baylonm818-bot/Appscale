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
  openSyncSession,
  closeSyncSession,
  getSyncSessionStatus,
  isSyncAllowed,
} = require('../controllers/mobileBeneficiaryControllers');
const { transferBeneficiary, getBarangays, checkDuplicate } = require('../controllers/masterlistControllers');

// Mobile app users are BNS/BHW — enforce role (allow admin for server-side queries)
router.use(roleCheck(['bhw', 'bns', 'admin']));

// Admin is view-only for children, mothers, and nutritional status — mutations restricted to BNS/BHW
router.post('/children', roleCheck(['bhw', 'bns']), upsertChild);
router.post('/mothers', roleCheck(['bhw', 'bns']), upsertMother);
router.post('/nutrition-records', roleCheck(['bhw', 'bns']), syncNutritionRecord);
router.put('/nutrition-records', roleCheck(['bhw', 'bns']), updateNutritionRecord);
router.patch('/nutrition-records', roleCheck(['bhw', 'bns']), updateNutritionRecord);
router.delete('/nutrition-records', roleCheck(['bhw', 'bns']), deleteNutritionRecord);
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

// Step 8: Time-based and time-bound sync gate middleware
// Checks whether sync session is open for the requesting user
const requireOpenSyncSession = async (req, res, next) => {
  const userId = req.user?.user_id;
  if (!userId) return next();
  try {
    const allowed = await isSyncAllowed(userId);
    if (!allowed) {
      return res.status(423).json({
        message: 'Sync window is closed. Synchronization is only allowed when an active work session is opened or at scheduled sync hours.',
        sync_window_open: false,
      });
    }
    next();
  } catch (e) {
    next();
  }
};

// Sync session control routes
router.post('/sync/session/open', openSyncSession);
router.post('/sync/session/close', closeSyncSession);
router.get('/sync/session/status', getSyncSessionStatus);

router.get('/children', getMobileChildren);
router.get('/mothers', getMobileMothers);
router.get('/schedules', getMobileSchedules);
router.get('/nutrition-records', getMobileNutritionRecords);
router.get('/sync', requireOpenSyncSession, getMobileSync);
router.get('/barangays', getBarangays);
router.get('/check-duplicate', checkDuplicate);

module.exports = router;