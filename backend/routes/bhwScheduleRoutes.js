const express = require('express');
const router = express.Router();
const { getBhwSchedules, markScheduleDone } = require('../controllers/bhwScheduleControllers');



router.get('/', getBhwSchedules);
router.patch('/:id/done', markScheduleDone);

module.exports = router;