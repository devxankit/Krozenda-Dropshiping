const express = require('express');
const {
  getDashboard,
  getDashboardSummary,
  getSalesAnalytics,
} = require('../Controllers/adminAnalyticsController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/dashboard', requirePermission('admin.dashboard.view'), getDashboard);
router.get('/dashboard-summary', requirePermission('admin.dashboard.view'), getDashboardSummary);
router.get('/analytics/sales', requirePermission('admin.analytics.view'), getSalesAnalytics);

module.exports = router;
