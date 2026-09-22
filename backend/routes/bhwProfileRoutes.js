const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/bhwProfileControllers');

router.get('/:id', getProfile);
router.put('/:id', updateProfile);
router.patch('/:id/password', changePassword);

module.exports = router;