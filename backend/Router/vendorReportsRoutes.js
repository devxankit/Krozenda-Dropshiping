const express = require('express');
const { getSalesReport, exportSalesReportCsv } = require('../Controllers/vendorReportsController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);
router.get('/sales', getSalesReport);
router.get('/sales/export', exportSalesReportCsv);

module.exports = router;
