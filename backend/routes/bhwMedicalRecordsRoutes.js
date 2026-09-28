const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getMedicalRecordsList, getMothersList, getChildMedicalHistory } = require('../controllers/bhwMedicalRecordsControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/', getMedicalRecordsList);
router.get('/mothers', getMothersList);
router.get('/:childId', getChildMedicalHistory);

module.exports = router;