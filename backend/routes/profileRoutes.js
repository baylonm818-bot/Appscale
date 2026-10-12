const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { upload, uploadProfilePicture, getProfile, updateProfile, changePassword, getProfilePictureData, deactivateAccount } = require('../controllers/profileControllers');

router.use(roleCheck(['admin', 'bhw', 'bns']));

// Explicit /me endpoints for the logged-in user
router.get('/me', getProfile);
router.get('/me/picture/data', getProfilePictureData);
router.put('/me', updateProfile);
router.patch('/me/password', changePassword);

const handleUpload = (req, res, next) => {
  upload.single('profile_picture')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    next();
  });
};

router.post('/me/picture', handleUpload, uploadProfilePicture);

// Parameterized /:id endpoints
router.get('/:id', getProfile);
router.get('/:id/picture/data', getProfilePictureData);
router.put('/:id', updateProfile);
router.patch('/:id/password', changePassword);
router.post('/:id/picture', handleUpload, uploadProfilePicture);
router.post('/:id/deactivate', roleCheck(['admin']), deactivateAccount);

module.exports = router;