const express = require('express');
const { getSummary, getBalance } = require('../Controllers/adminCjDashboardController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.view'));

router.get('/dashboard', getSummary);
router.get('/balance', getBalance);

module.exports = router;
