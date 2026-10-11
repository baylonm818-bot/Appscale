const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { upload, uploadProfilePicture, getProfile, updateProfile, changePassword, getProfilePictureData, deactivateAccount } = require('../controllers/profileControllers');

router.use(roleCheck(['admin', 'bhw', 'bns']));

router.get('/:id', getProfile);
router.get('/:id/picture/data', getProfilePictureData);
router.put('/:id', updateProfile);
router.patch('/:id/password', changePassword);
const handleUpload = (req, res, next) => {
  upload.single('profile_picture')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    next();
  });
};

router.post('/:id/picture', handleUpload, uploadProfilePicture);
router.post('/:id/deactivate', roleCheck(['admin']), deactivateAccount);


module.exports = router;