const express = require('express');
const router = express.Router();
const { getMedicalRecordsList, getChildMedicalHistory } = require('../controllers/bhwMedicalRecordsControllers');

router.get('/', getMedicalRecordsList);
router.get('/:childId', getChildMedicalHistory);

module.exports = router;