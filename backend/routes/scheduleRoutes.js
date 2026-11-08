const express = require('express');
const router = express.Router();
const {
  getScheduleStats, getSchedules, createSchedule,
  updateScheduleStatus, updateSchedule, deleteSchedule,
  getScheduleParticipants, submitScheduleAudit,
} = require('../controllers/scheduleControllers');
const roleCheck = require('../middleware/roleMiddleware');

// Admin-only schedule management
router.use(roleCheck(['admin', 'bns', 'bhw']));

router.get('/stats', roleCheck(['admin']), getScheduleStats);
router.get('/',      roleCheck(['admin']), getSchedules);
router.post('/',     roleCheck(['admin']), createSchedule);
router.put('/:id',   roleCheck(['admin']), updateSchedule);
router.delete('/:id', roleCheck(['admin']), deleteSchedule);
router.patch('/:id/status', roleCheck(['admin']), updateScheduleStatus);

// Step 6: participants & audit — accessible to admin, bns, bhw
router.get('/:id/participants', getScheduleParticipants);
router.post('/:id/audit',       submitScheduleAudit);

module.exports = router;