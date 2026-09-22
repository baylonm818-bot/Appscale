const express = require('express');
const router = express.Router();
const { getUsers, createUsers, updateUser, updateUserStatus, getUserStats, archiveUser, restoreUser } = require('../controllers/userControllers');
const roleCheck = require('../middleware/roleMiddleware');

// Only admin can manage users
router.get('/', roleCheck(['admin']), getUsers);
router.post('/', roleCheck(['admin']), createUsers);
router.put('/:user_id', roleCheck(['admin']), updateUser);
router.patch('/:user_id/status', roleCheck(['admin']), updateUserStatus);
router.patch('/:user_id/archive', roleCheck(['admin']), archiveUser);
router.patch('/:user_id/restore', roleCheck(['admin']), restoreUser);
router.get('/stats', roleCheck(['admin']), getUserStats);

module.exports = router;