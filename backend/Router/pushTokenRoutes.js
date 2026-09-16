const express = require('express');
const { registerFcmToken, removeFcmToken } = require('../Controllers/pushTokenController');
const { protectAnyAccount } = require('../Middlewares/anyAccountAuthMiddleware');

const router = express.Router();

router.use(protectAnyAccount);

router.post('/', registerFcmToken);
router.delete('/', removeFcmToken);

module.exports = router;
