const express = require('express');
const router = express.Router();
const { getUsers, createUsers, updateUser, updateUserStatus, getUserStats, archiveUser, restoreUser, unlockUserByIdentifier } = require('../controllers/userControllers');
const roleCheck = require('../middleware/roleMiddleware');

// Admin manages accounts; BHW may view and update same-barangay staff records
router.get('/', roleCheck(['admin', 'bhw']), getUsers);
router.post('/', roleCheck(['admin']), createUsers);
router.put('/:user_id', roleCheck(['admin']), updateUser);
router.patch('/:user_id/status', roleCheck(['admin']), updateUserStatus);
router.patch('/:user_id/archive', roleCheck(['admin']), archiveUser);
router.patch('/:user_id/restore', roleCheck(['admin']), restoreUser);
router.patch('/unlock', roleCheck(['admin']), unlockUserByIdentifier);
router.get('/stats', roleCheck(['admin', 'bhw']), getUserStats);

module.exports = router;