const express = require('express');
const router = express.Router();
const { getNeedAttention, createChildService } = require('../controllers/bhwNeedAttentionControllers');
router.post('/child-services', createChildService);
router.get('/', getNeedAttention);


module.exports = router;