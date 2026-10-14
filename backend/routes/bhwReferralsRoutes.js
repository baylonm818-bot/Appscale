const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  createReferral,
  getReferrals,
  updateReferralStatus,
  archiveReferral,
  unarchiveReferral,
  archiveCompletedReferrals,
} = require('../controllers/bhwRefferalsControllers');

// BHW/BNS (field workers) and Admin can access referrals
router.use(roleCheck(['bhw', 'bns', 'admin']));

// Only BNS can create referrals; BHW and Admin can view and update status
router.post('/', roleCheck(['bns']), createReferral);
router.get('/', getReferrals);
router.patch('/archive-completed', archiveCompletedReferrals);
router.post('/archive-completed', archiveCompletedReferrals);
router.patch('/:id/archive', archiveReferral);
router.patch('/:id/unarchive', unarchiveReferral);
router.patch('/:id/status', updateReferralStatus);

module.exports = router;