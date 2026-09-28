const express = require('express');
const router = express.Router();
const { getScheduleStats, getSchedules, createSchedule, updateScheduleStatus } = require('../controllers/scheduleControllers');
const roleCheck = require('../middleware/roleMiddleware');

// Protect all admin schedule routes with admin role check
router.use(roleCheck(['admin']));

router.get('/stats', getScheduleStats);
router.get('/', getSchedules);
router.post('/', createSchedule);
router.patch('/:id/status', updateScheduleStatus);

module.exports = router;