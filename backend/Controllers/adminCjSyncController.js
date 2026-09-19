const CjSyncLog = require('../Models/CjSyncLog');
const cjInventoryService = require('../services/cj/cjInventoryService');
const cjSyncJob = require('../Jobs/cjSyncJob');

// GET /admin/cj/sync-logs?status=&pageNum=&pageSize=
async function listSyncLogs(req, res) {
  const { status } = req.query;
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 25, 100);
  const filter = status && ['SUCCESS', 'FAILED'].includes(status) ? { status } : {};

  const [rows, total] = await Promise.all([
    CjSyncLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    CjSyncLog.countDocuments(filter),
  ]);

  res.json({ success: true, data: { list: rows, pageNum, pageSize, total } });
}

// GET /admin/cj/sync-logs/job-status — job-lock visibility (stuck-job recovery, §32)
async function getJobStatus(req, res) {
  res.json({ success: true, data: cjSyncJob.status() });
}

// POST /admin/cj/sync-logs/run-now — manual sync trigger for one product or all
async function runSyncNow(req, res) {
  const { cjProductId } = req.body || {};

  try {
    if (cjProductId) {
      const result = await cjInventoryService.syncOneByCjProductId(cjProductId, { trigger: 'MANUAL' });
      return res.json({ success: result.ok, message: result.ok ? 'Synced' : result.error, data: result });
    }

    const result = await cjInventoryService.syncAll({ trigger: 'MANUAL' });
    res.json({ success: true, message: `Synced ${result.succeeded}/${result.total}`, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { listSyncLogs, getJobStatus, runSyncNow };
