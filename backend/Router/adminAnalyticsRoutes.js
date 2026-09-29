const express = require('express');
const {
  getDashboard,
  getDashboardSummary,
  getSalesAnalytics,
  getVendorAnalytics,
  getCatalogAnalytics,
  getCustomerAnalytics,
} = require('../Controllers/adminAnalyticsController');
const { getAdminRevenue, getAdminSellerRevenue } = require('../Controllers/revenueController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { responseCache } = require('../Middlewares/responseCache');

const router = express.Router();

router.use(protectAdmin);

// Shared, short-lived results for these reports (see responseCache). After
// the permission check on each route, so caching never widens access.
const cached = responseCache();

router.get('/dashboard', requirePermission('admin.dashboard.view'), cached, getDashboard);
router.get('/dashboard-summary', requirePermission('admin.dashboard.view'), cached, getDashboardSummary);
router.get('/analytics/sales', requirePermission('admin.analytics.view'), cached, getSalesAnalytics);
router.get('/analytics/vendors', requirePermission('admin.analytics.view'), cached, getVendorAnalytics);
router.get('/analytics/catalog', requirePermission('admin.analytics.view'), cached, getCatalogAnalytics);
router.get('/analytics/customers', requirePermission('admin.analytics.view'), cached, getCustomerAnalytics);
router.get('/analytics/revenue', requirePermission('admin.analytics.view'), cached, getAdminRevenue);
router.get('/analytics/revenue/sellers/:id', requirePermission('admin.analytics.view'), cached, getAdminSellerRevenue);

module.exports = router;
