const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/bhwNotificationControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;