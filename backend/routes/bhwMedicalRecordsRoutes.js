const express = require('express');
const router = express.Router();
const { getMedicalRecordsList, getMothersList, getChildMedicalHistory } = require('../controllers/bhwMedicalRecordsControllers');

router.get('/', getMedicalRecordsList);
router.get('/mothers', getMothersList);
router.get('/:childId', getChildMedicalHistory);

module.exports = router;