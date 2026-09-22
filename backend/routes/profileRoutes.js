const express = require('express');
const router = express.Router();
const { upload, uploadProfilePicture, getProfile, updateProfile, changePassword, getProfilePictureData } = require('../controllers/profileControllers');

router.get('/:id', getProfile);
router.get('/:id/picture/data', getProfilePictureData);
router.put('/:id', updateProfile);
router.patch('/:id/password', changePassword);
router.post('/:id/picture', upload.single('profile_picture'),uploadProfilePicture);


module.exports = router;