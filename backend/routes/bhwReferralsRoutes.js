const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { createReferral, getReferrals, updateReferralStatus } = require('../controllers/bhwRefferalsControllers');

// BHW/BNS (field workers) and Admin can access referrals
router.use(roleCheck(['bhw', 'bns', 'admin']));

router.post('/', createReferral);
router.get('/', getReferrals);
router.patch('/:id/status', updateReferralStatus);

module.exports = router;