const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  getBhwSchedules,
  createBhwSchedule,
  markScheduleDone,
  updateBhwScheduleStatus,
  submitBhwScheduleAudit,
} = require('../controllers/bhwScheduleControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/', getBhwSchedules);
router.post('/', createBhwSchedule);
router.patch('/:id/done', markScheduleDone);
router.patch('/:id/status', updateBhwScheduleStatus);
// Step 6: audit submission
router.post('/:id/audit', submitBhwScheduleAudit);

module.exports = router;