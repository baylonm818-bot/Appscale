const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { createReferral, getReferrals, updateReferralStatus } = require('../controllers/bhwRefferalsControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.post('/', createReferral);
router.get('/', getReferrals);
router.patch('/:id/status', updateReferralStatus);

module.exports = router;