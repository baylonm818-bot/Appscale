const express = require('express');
const router = express.Router();
const { getMasterlistStats, getChildren, getMothers } = require('../controllers/masterlistControllers');
const roleCheck = require('../middleware/roleMiddleware');

router.get('/stats', roleCheck(['admin']), getMasterlistStats);
router.get('/children', roleCheck(['admin']), getChildren);
router.get('/mothers', roleCheck(['admin']), getMothers);

module.exports = router;