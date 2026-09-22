const express = require('express');
const router = express.Router();
const { getScheduleStats, getSchedules, createSchedule, updateScheduleStatus } = require('../controllers/scheduleControllers');

router.get('/stats', getScheduleStats);
router.get('/', getSchedules);
router.post('/', createSchedule);
router.patch('/:id/status', updateScheduleStatus);

module.exports = router;