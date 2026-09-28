const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const { getNeedAttention, createChildService } = require('../controllers/bhwNeedAttentionControllers');

// BHW/BNS only
router.use(roleCheck(['bhw', 'bns']));

router.post('/child-services', createChildService);
router.get('/', getNeedAttention);

module.exports = router;