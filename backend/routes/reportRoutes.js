const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getSignatories, updateSignatories } = require('../controllers/reportControllers');

// Any authenticated role can read signatories (for printing)
router.get('/signatories', getSignatories);

// Only admin can update signatories
router.put('/signatories', roleCheck(['admin']), updateSignatories);

module.exports = router;
