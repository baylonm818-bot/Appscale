const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  getBhwSchedules,
  createBhwSchedule,
  markScheduleDone,
  updateBhwScheduleStatus,
} = require('../controllers/bhwScheduleControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/', getBhwSchedules);
router.post('/', createBhwSchedule);
router.patch('/:id/done', markScheduleDone);
router.patch('/:id/status', updateBhwScheduleStatus);

module.exports = router;