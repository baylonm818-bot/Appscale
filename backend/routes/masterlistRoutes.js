const express = require('express');
const router = express.Router();
const { getMasterlistStats, getChildren, getMothers } = require('../controllers/masterlistControllers');

router.get('/stats', getMasterlistStats);
router.get('/children', getChildren);
router.get('/mothers', getMothers);

module.exports = router;