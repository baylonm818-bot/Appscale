const express = require('express');
const router = express.Router();
const { getMasterlistStats, getChildren, getMothers, transferBeneficiary, getBarangays, checkDuplicate } = require('../controllers/masterlistControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/stats', roleCheck(['admin']), getMasterlistStats);
router.get('/children', roleCheck(['admin', 'bhw', 'bns']), getChildren);
router.get('/mothers', roleCheck(['admin', 'bhw', 'bns']), getMothers);
router.get('/barangays', roleCheck(['admin', 'bhw', 'bns']), getBarangays);
router.get('/check-duplicate', roleCheck(['admin', 'bhw', 'bns']), checkDuplicate);
router.post('/transfer', roleCheck(['admin', 'bns']), transferBeneficiary);

module.exports = router;