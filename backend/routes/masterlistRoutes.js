const express = require('express');
const router = express.Router();
const { getMasterlistStats, getChildren, getMothers, transferBeneficiary } = require('../controllers/masterlistControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/stats', roleCheck(['admin']), getMasterlistStats);
router.get('/children', roleCheck(['admin', 'bhw', 'bns']), getChildren);
router.get('/mothers', roleCheck(['admin', 'bhw', 'bns']), getMothers);
router.post('/transfer', roleCheck(['admin', 'bns']), transferBeneficiary);

module.exports = router;