const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationControllers');

// Admin-only: all notification routes
router.use(roleCheck(['admin']));

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;