const express = require('express');
const router = express.Router();
const {
  getBhwSchedules,
  createBhwSchedule,
  markScheduleDone,
  updateBhwScheduleStatus,
} = require('../controllers/bhwScheduleControllers');

router.get('/', getBhwSchedules);
router.post('/', createBhwSchedule);
router.patch('/:id/done', markScheduleDone);
router.patch('/:id/status', updateBhwScheduleStatus);

module.exports = router;