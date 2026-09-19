const CjShipment = require('../Models/CjShipment');
const cjLogisticsService = require('../services/cj/cjLogisticsService');

// GET /admin/cj/shipments?status=&pageNum=&pageSize=
async function listShipments(req, res) {
  const { status } = req.query;
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
  const filter = status ? { status } : {};

  const [rows, total] = await Promise.all([
    CjShipment.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    CjShipment.countDocuments(filter),
  ]);

  res.json({ success: true, data: { list: rows, pageNum, pageSize, total } });
}

// GET /admin/cj/shipments/:id — tracking detail
async function getShipment(req, res) {
  const shipment = await CjShipment.findById(req.params.id).populate('cjOrder');
  if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: shipment });
}

// POST /admin/cj/shipments/:id/refresh-tracking — manual pull, same path the
// webhook and poller use
async function refreshTracking(req, res) {
  const shipment = await CjShipment.findById(req.params.id);
  if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

  try {
    const updated = await cjLogisticsService.syncShipment(shipment);
    res.json({ success: true, message: 'Tracking refreshed', data: updated });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
}

// POST /admin/cj/shipments/freight-quote
// body: { startCountryCode, endCountryCode, zip, items: [{ cjVariantId, quantity }] }
async function freightQuote(req, res) {
  const { startCountryCode, endCountryCode, zip, items } = req.body || {};

  try {
    const options = await cjLogisticsService.calculateFreight({ startCountryCode, endCountryCode, zip, items });
    res.json({ success: true, data: options });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { listShipments, getShipment, refreshTracking, freightQuote };
