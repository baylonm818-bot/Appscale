const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getProfile, updateProfile, changePassword } = require('../controllers/bhwProfileControllers');
const { upload, uploadProfilePicture } = require('../controllers/profileControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.get('/:id', getProfile);
router.put('/:id', updateProfile);
router.patch('/:id/password', changePassword);
router.post('/:id/picture', upload.single('profile_picture'), uploadProfilePicture);

module.exports = router;