const express = require('express');
const router = express.Router();
const { createReferral, getReferrals, updateReferralStatus } = require('../controllers/bhwRefferalsControllers');

router.post('/', createReferral);
router.get('/', getReferrals);
router.patch('/:id/status', updateReferralStatus);

module.exports = router;