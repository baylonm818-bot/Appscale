const express = require('express');
const router = express.Router();
const { upsertChild, upsertMother } = require('../controllers/mobileBeneficiaryControllers');

router.post('/children', upsertChild);
router.post('/mothers', upsertMother);

module.exports = router;