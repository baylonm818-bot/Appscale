const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  getMedicalRecordsList,
  getMothersList,
  getChildMedicalHistory,
  getMotherMedicalHistory,
  createChildMedicalRecord,
  createMotherMedicalRecord,
  getMedicalRecordsAuditTrail,
} = require('../controllers/bhwMedicalRecordsControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/', getMedicalRecordsList);
router.get('/mothers', getMothersList);
router.get('/mothers/:motherId', getMotherMedicalHistory);
router.get('/audit-trail', getMedicalRecordsAuditTrail);
router.get('/:childId', getChildMedicalHistory);

router.post('/child-services', createChildMedicalRecord);
router.post('/mother-services', createMotherMedicalRecord);

module.exports = router;