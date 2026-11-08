const express = require('express');
const router = express.Router();
const {
  getMasterlistStats, getChildren, getMothers,
  transferBeneficiary, getBarangays, checkDuplicate,
  getDisabilityOptions,
  createChild, updateChild,
  getChildFeedingHistory, addFeedingMeal,
  getChildAbsences,
} = require('../controllers/masterlistControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/stats',           roleCheck(['admin']),                getMasterlistStats);
router.get('/children',        roleCheck(['admin', 'bhw', 'bns']), getChildren);
router.get('/mothers',         roleCheck(['admin', 'bhw', 'bns']), getMothers);
router.get('/barangays',       roleCheck(['admin', 'bhw', 'bns']), getBarangays);
router.get('/disabilities',    roleCheck(['admin', 'bhw', 'bns']), getDisabilityOptions);
router.get('/check-duplicate', roleCheck(['admin', 'bhw', 'bns']), checkDuplicate);
router.post('/transfer',       roleCheck(['admin', 'bns']),         transferBeneficiary);

// Step 1: child create/update with disability + required fields validation
router.post('/children',         roleCheck(['admin', 'bns']),         createChild);
router.put('/children/:id',      roleCheck(['admin', 'bns']),         updateChild);

// Step 4: feeding history (food history + effectiveness)
router.get('/children/:id/feeding-history',           roleCheck(['admin', 'bhw', 'bns']), getChildFeedingHistory);
router.post('/attendance/:attendance_id/meals',       roleCheck(['admin', 'bhw', 'bns']), addFeedingMeal);

// Step 5: absence history
router.get('/children/:id/absences', roleCheck(['admin', 'bhw', 'bns']), getChildAbsences);

module.exports = router;