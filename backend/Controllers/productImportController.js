const { getImageUrl } = require('../utils/imageHelper');
const importService = require('../services/productImport/importService');
const { MAX_ROWS } = require('../services/productImport/importRows');

// CSV product import, shared by the admin panel (/admin/catalog/import) and
// the seller panel (/vendor/products/import). The route sets `req.importScope`
// from whoever is signed in; everything below is identical for both.
// See services/productImport/importService.js for the lifecycle.

function toInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function serializeBatch(batch, extra = {}) {
  return {
    id: String(batch._id),
    fileName: batch.fileName,
    status: batch.status,
    duplicateMode: batch.duplicateMode,
    mode: batch.mode || 'STAGED',
    createdByName: batch.createdByName || '',
    createdAt: batch.createdAt,
    processedAt: batch.processedAt,
    reviewedAt: batch.reviewedAt,
    reviewedByName: batch.reviewedByName || '',
    errorMessage: batch.errorMessage || '',
    rejectionReason: batch.rejectionReason || '',
    progress: { processed: batch.progress?.processed || 0, total: batch.progress?.total || 0 },
    counts: {
      totalRows: batch.totalRows,
      products: batch.productCount,
      valid: batch.validCount,
      invalid: batch.invalidCount,
      created: batch.createdCount,
      updated: batch.updatedCount,
      skipped: batch.skippedCount,
      failed: batch.failedCount,
      approved: batch.approvedCount || 0,
      ...extra,
    },
  };
}

function serializeRow(row) {
  const d = row.data || {};
  return {
    id: String(row._id),
    index: row.index,
    lines: row.lines,
    status: row.status,
    action: row.action,
    excluded: Boolean(row.excluded),
    errors: row.issues || [],
    notes: row.notes || [],
    existingProduct: row.existingProduct ? { id: String(row.existingProduct), name: row.existingProductName } : null,
    resultProductId: row.resultProduct ? String(row.resultProduct) : null,
    resultMessage: row.resultMessage || '',
    product: {
      name: d.name ?? null,
      sku: d.sku ?? null,
      category: d.category ? { id: d.category, name: d.categoryName } : null,
      brand: d.brand ? { id: d.brand, name: d.brandName } : null,
      price: d.price ?? null,
      salePrice: d.salePrice ?? null,
      mrp: d.mrp ?? null,
      costPrice: d.costPrice ?? null,
      stock: d.stock ?? null,
      weight: d.weight ?? null,
      dimensions: d.dimensions ?? null,
      hsnCode: d.hsnCode ?? null,
      gstRate: d.gstRate ?? null,
      moq: d.moq ?? null,
      status: d.status ?? null,
      isReturnable: d.isReturnable ?? null,
      shortDescription: d.shortDescription ?? null,
      description: d.description ?? null,
      images: (d.images || []).map(getImageUrl),
      imageSources: d.imageSources || [],
      variants: (d.variants || []).map((v) => ({
        name: v.name,
        attributes: v.attributes || {},
        sku: v.sku || '',
        price: v.price ?? null,
        salePrice: v.salePrice ?? null,
        stock: v.stock ?? 0,
        weight: v.weight ?? null,
        image: v.image ? getImageUrl(v.image) : null,
      })),
    },
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof importService.ImportError) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      throw err;
    }
  };
}

// GET /template
async function getTemplate(req, res) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="krozenda-product-import-template.csv"');
  res.send(importService.buildTemplateCsv());
}

// POST /  (multipart: file, duplicateMode)
async function uploadImport(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Attach a CSV file to import' });
  }
  const { batch } = await importService.stageImport(req.importScope, {
    buffer: req.file.buffer,
    fileName: req.file.originalname,
    duplicateMode: String(req.body?.duplicateMode || '').toUpperCase(),
  });
  res.status(202).json({
    success: true,
    message: 'File received. Checking rows and fetching images — nothing is added to the catalog until you approve.',
    data: serializeBatch(batch),
  });
}

// GET /
async function listImports(req, res) {
  const page = toInt(req.query.page, 1, 10000);
  const limit = toInt(req.query.limit, 20, 100);
  const { items, total } = await importService.listBatches(req.importScope, {
    page,
    limit,
    status: typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined,
  });
  res.json({
    success: true,
    data: items.map((b) => serializeBatch(b)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

// GET /:id
async function getImport(req, res) {
  const { batch, excludedCount } = await importService.getBatch(req.importScope, req.params.id);
  res.json({ success: true, data: serializeBatch(batch, { excluded: excludedCount }) });
}

// GET /:id/rows?filter=valid|invalid|excluded|created|updated|skipped|failed
async function listImportRows(req, res) {
  const page = toInt(req.query.page, 1, 10000);
  const limit = toInt(req.query.limit, 25, 100);
  const { items, total } = await importService.listRows(req.importScope, req.params.id, {
    page,
    limit,
    filter: typeof req.query.filter === 'string' ? req.query.filter : undefined,
  });
  res.json({
    success: true,
    data: items.map(serializeRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

// PATCH /:id/rows  { rowIds: [], all: bool, excluded: bool }
async function updateImportRows(req, res) {
  const changed = await importService.setRowsExcluded(req.importScope, req.params.id, {
    rowIds: req.body?.rowIds,
    all: req.body?.all === true,
    excluded: req.body?.excluded === true,
  });
  res.json({ success: true, message: `${changed} row${changed === 1 ? '' : 's'} updated`, data: { changed } });
}

// POST /:id/approve
async function approveImport(req, res) {
  const { batch, message } = await importService.approveBatch(req.importScope, req.params.id);
  res.json({ success: batch.status === 'APPROVED', message, data: serializeBatch(batch) });
}

// POST /approve-products  { productIds: [], all: bool } — preview mode:
// approves imported preview products. Live straight away for admin; for a
// seller, live only with auto-approval, else sent to the approval queue.
async function approvePreviewProducts(req, res) {
  const { approved, live } = await importService.approvePreviewProducts(req.importScope, {
    productIds: req.body?.productIds,
    all: req.body?.all === true,
  });
  const noun = `${approved} product${approved === 1 ? '' : 's'}`;
  res.json({
    success: true,
    message: live ? `${noun} approved and now live` : `${noun} submitted — they go live once the platform approves them`,
    data: { approved, live },
  });
}

// POST /:id/reject  { reason }
async function rejectImport(req, res) {
  const batch = await importService.rejectBatch(req.importScope, req.params.id, req.body?.reason);
  res.json({ success: true, message: 'Import rejected. Nothing was added to the catalog.', data: serializeBatch(batch) });
}

module.exports = {
  getTemplate: handle(getTemplate),
  uploadImport: handle(uploadImport),
  listImports: handle(listImports),
  getImport: handle(getImport),
  listImportRows: handle(listImportRows),
  updateImportRows: handle(updateImportRows),
  approveImport: handle(approveImport),
  rejectImport: handle(rejectImport),
  approvePreviewProducts: handle(approvePreviewProducts),
  MAX_ROWS,
};
