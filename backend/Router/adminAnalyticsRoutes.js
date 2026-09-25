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

const router = express.Router();

router.use(protectAdmin);

router.get('/dashboard', requirePermission('admin.dashboard.view'), getDashboard);
router.get('/dashboard-summary', requirePermission('admin.dashboard.view'), getDashboardSummary);
router.get('/analytics/sales', requirePermission('admin.analytics.view'), getSalesAnalytics);
router.get('/analytics/vendors', requirePermission('admin.analytics.view'), getVendorAnalytics);
router.get('/analytics/catalog', requirePermission('admin.analytics.view'), getCatalogAnalytics);
router.get('/analytics/customers', requirePermission('admin.analytics.view'), getCustomerAnalytics);
router.get('/analytics/revenue', requirePermission('admin.analytics.view'), getAdminRevenue);
router.get('/analytics/revenue/sellers/:id', requirePermission('admin.analytics.view'), getAdminSellerRevenue);

module.exports = router;
