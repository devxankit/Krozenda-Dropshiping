const express = require('express');
const { getWallet, createTopupOrder, verifyTopup } = require('../Controllers/walletController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', getWallet);
router.post('/topup/order', createTopupOrder);
router.post('/topup/verify', verifyTopup);

module.exports = router;
