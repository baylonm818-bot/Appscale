const express = require('express');
const router = express.Router();
const { getPuroks, createPurok, updatePurok, togglePurokStatus } = require('../controllers/purokControllers');
const jwtMiddleware = require('../middleware/jwtMiddleware');
const roleCheck = require('../middleware/roleMiddleware');

// Public or authenticated read: Admin, BHW, BNS
router.get('/', getPuroks);

// Admin-only management routes
router.post('/', jwtMiddleware, roleCheck(['admin']), createPurok);
router.put('/:id', jwtMiddleware, roleCheck(['admin']), updatePurok);
router.patch('/:id/status', jwtMiddleware, roleCheck(['admin']), togglePurokStatus);

module.exports = router;
