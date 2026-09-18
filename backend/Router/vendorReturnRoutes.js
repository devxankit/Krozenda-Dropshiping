const express = require('express');
const { listMyReturns, recommendOnReturn } = require('../Controllers/vendorReturnController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);
router.get('/', listMyReturns);
// Advisory only — it records the seller's view and never changes the request's
// status. Admin still decides (adminReturnController.decideReturnRequest).
router.post('/:id/recommend', recommendOnReturn);

module.exports = router;
