const cjDashboardService = require('../services/cj/cjDashboardService');
const cjAccountService = require('../services/cj/cjAccountService');
const cjAuthService = require('../services/cj/cjAuthService');

// GET /admin/cj/dashboard
async function getSummary(req, res) {
  const summary = await cjDashboardService.getSummary();
  res.json({ success: true, data: summary });
}

// GET /admin/cj/balance
async function getBalance(req, res) {
  try {
    const balance = await cjAccountService.getBalance();
    res.json({ success: true, data: balance });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: cjAuthService.safeFailureMessage(err.code) || 'Unable to fetch CJ balance.',
    });
  }
}

module.exports = { getSummary, getBalance };
