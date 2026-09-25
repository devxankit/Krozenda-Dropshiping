const mongoose = require('mongoose');
const Product = require('../../Models/Product');
const Category = require('../../Models/Category');
const Brand = require('../../Models/Brand');
const CatalogSettings = require('../../Models/CatalogSettings');
const ProductImport = require('../../Models/ProductImport');
const ProductImportRow = require('../../Models/ProductImportRow');
const { PUBLIC_APPROVAL_FILTER } = require('../../utils/publicVisibility');
const { validateVariants } = require('../../utils/productVariants');
const { parseCsv, toCsv } = require('../../utils/csv');
const { COLUMNS, MAX_ROWS, mapHeaders, normaliseRecord, groupRecords, buildProduct } = require('./importRows');
const remoteImage = require('./remoteImage');

// CSV product import: upload -> validate -> preview -> review -> approve.
//
// The one rule everything here serves: NOTHING reaches the Product collection
// until the uploader approves the batch. Upload stages rows in
// ProductImportRow (with their images already fetched, so the preview shows
// real pictures), and only approveBatch() writes products.
//
// `scope` is { ownerType: 'ADMIN'|'VENDOR', vendorId, actorId, actorName } and
// is built by the route from the authenticated admin or vendor. Every lookup
// is filtered by it, so a vendor can never see or act on another owner's batch.

const IMAGE_CONCURRENCY = 4;
// A batch still PROCESSING/APPROVING this long after its last write was
// interrupted (a restart mid-job) and is marked FAILED rather than spinning
// in the UI forever.
const STALE_MS = 10 * 60 * 1000;

class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function scopeFilter(scope) {
  return scope.ownerType === 'VENDOR'
    ? { ownerType: 'VENDOR', vendor: scope.vendorId }
    : { ownerType: 'ADMIN' };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function buildTemplateCsv() {
  const headers = COLUMNS.map((c) => c.key);
  const example = Object.fromEntries(COLUMNS.map((c) => [c.key, c.example]));
  // A second line on the same SKU shows how variants are written.
  const variantLine = { sku: example.sku, variantName: 'Blue / M', variantAttributes: 'Color:Blue|Size:M', variantSku: 'ORG-TEE-001-BM', variantStock: '30' };
  return toCsv(headers, [example, variantLine]);
}

// ---------------------------------------------------------------------------
// Catalog lookups shared by staging and approval
// ---------------------------------------------------------------------------

async function loadLookups(scope, skus) {
  const visible =
    scope.ownerType === 'VENDOR'
      ? { isActive: true, $or: [{ approvalStatus: PUBLIC_APPROVAL_FILTER }, { createdByVendor: scope.vendorId }] }
      : { isActive: true, approvalStatus: { $ne: 'REJECTED' } };

  const [categories, brands, existing] = await Promise.all([
    Category.find(visible).select('name').lean(),
    Brand.find(visible).select('name').lean(),
    skus.length
      ? Product.find({ sku: { $in: skus } }).select('name sku vendor fulfillmentProvider price').lean()
      : [],
  ]);

  return {
    categoryByName: new Map(categories.map((c) => [c.name.trim().toLowerCase(), c])),
    categoryById: new Map(categories.map((c) => [String(c._id), c])),
    brandByName: new Map(brands.map((b) => [b.name.trim().toLowerCase(), b])),
    brandById: new Map(brands.map((b) => [String(b._id), b])),
    existingBySku: new Map(existing.map((p) => [p.sku, p])),
  };
}

// ---------------------------------------------------------------------------
// Stage 1 — upload
// ---------------------------------------------------------------------------

// Checks the file as a whole (readable, has the required columns, not too
// big) synchronously, so a wrong file is refused on the spot. Then creates
// the batch and hands the slow part — per-row validation and image fetching
// — to processBatch in the background. Returns the PROCESSING batch.
async function stageImport(scope, { buffer, fileName, duplicateMode }) {
  if (scope.ownerType === 'ADMIN') {
    const settings = await CatalogSettings.getSettings();
    if (settings.sellerOnlyMode) {
      throw new ImportError('Seller-only catalog mode is on: new products can only be submitted by sellers.', 403);
    }
  }

  let parsed;
  try {
    parsed = parseCsv(buffer.toString('utf8'));
  } catch {
    throw new ImportError('That file could not be read as CSV');
  }
  if (parsed.headers.length === 0) throw new ImportError('The file is empty');
  if (parsed.rows.length === 0) throw new ImportError('The file has a header row but no products');
  if (parsed.rows.length > MAX_ROWS) {
    throw new ImportError(`That file has ${parsed.rows.length} rows. Split it into uploads of ${MAX_ROWS} or fewer.`);
  }

  const { mapping, missing } = mapHeaders(parsed.headers);
  if (missing.length) {
    throw new ImportError(
      `The file is missing required columns: ${missing.join(', ')}. Download the template to see the expected format.`
    );
  }

  await sweepStale(scope);
  // One import at a time per owner: each one fetches images from the open
  // internet, and that should not be something a user can fan out.
  const running = await ProductImport.exists({ ...scopeFilter(scope), status: { $in: ['PROCESSING', 'APPROVING'] } });
  if (running) throw new ImportError('Another import is still being processed. Wait for it to finish.', 409);

  const records = parsed.rows.map((r) => normaliseRecord(r, mapping));
  const batch = await ProductImport.create({
    ownerType: scope.ownerType,
    vendor: scope.ownerType === 'VENDOR' ? scope.vendorId : null,
    createdById: scope.actorId || null,
    createdByName: scope.actorName || '',
    fileName: String(fileName || 'products.csv').slice(0, 200),
    // A preview import only ever adds new products: an update to a live
    // product has no "preview" to show, so existing SKUs are skipped.
    duplicateMode: scope.mode !== 'PREVIEW' && duplicateMode === 'UPDATE' ? 'UPDATE' : 'SKIP',
    mode: scope.mode === 'PREVIEW' ? 'PREVIEW' : 'STAGED',
    totalRows: records.length,
    status: 'PROCESSING',
  });

  const job = processBatch(batch._id, scope, records).catch(async (err) => {
    console.error(`[product-import] batch ${batch._id} failed:`, err);
    await ProductImport.updateOne(
      { _id: batch._id, status: 'PROCESSING' },
      { $set: { status: 'FAILED', errorMessage: 'The file could not be processed. Please try again.' } }
    ).catch(() => {});
  });

  return { batch, job };
}

// Runs a list of async tasks with at most `limit` in flight.
async function runPool(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

// Validates every product, fetches its images, and stores the staged rows.
async function processBatch(batchId, scope, records) {
  const batch = await ProductImport.findById(batchId);
  const groups = groupRecords(records);
  const skus = [...new Set(groups.map((g) => String(g[0].sku || '').trim()).filter(Boolean))];
  const lookups = await loadLookups(scope, skus);
  const ctx = { ...lookups, ownerType: scope.ownerType, vendorId: scope.vendorId, duplicateMode: batch.duplicateMode };

  const built = groups.map((group) => buildProduct(group, ctx));
  await ProductImport.updateOne({ _id: batchId }, { $set: { productCount: built.length, 'progress.total': built.length } });

  let processed = 0;
  let lastProgressWrite = 0;

  await runPool(built, IMAGE_CONCURRENCY, async (item) => {
    item.stagedImages = [];
    // Skipped and invalid rows never become products, so their images are
    // not worth downloading.
    if (!item.errors.length && item.action !== 'SKIP') {
      const cache = new Map(); // same URL used twice in one product -> one file
      const fetchOne = async (url, label) => {
        if (cache.has(url)) return cache.get(url);
        try {
          const stored = await remoteImage.fetchAndStoreImage(url);
          item.stagedImages.push(stored);
          cache.set(url, stored);
          return stored;
        } catch (err) {
          item.errors.push(`${label} (${url}) could not be downloaded: ${err.message}`);
          cache.set(url, null);
          return null;
        }
      };

      const images = [];
      for (let i = 0; i < item.imageUrls.length; i += 1) {
        const stored = await fetchOne(item.imageUrls[i], `image ${i + 1}`);
        if (stored) images.push(stored);
      }
      for (const { index, url } of item.variantImageUrls) {
        const stored = await fetchOne(url, `variant "${item.data.variants[index].name}" image`);
        if (stored) {
          item.data.variants[index].image = stored;
          if (!images.includes(stored)) images.push(stored);
        }
      }
      if (images.length) {
        item.data.images = images;
        item.data.imageSources = item.imageUrls;
      }
      if (item.errors.length) item.action = null;
    }

    processed += 1;
    const now = Date.now();
    if (now - lastProgressWrite > 1500 || processed === built.length) {
      lastProgressWrite = now;
      await ProductImport.updateOne({ _id: batchId }, { $set: { 'progress.processed': processed } });
    }
  });

  // An invalid row keeps nothing on disk.
  for (const item of built) {
    if (item.errors.length && item.stagedImages.length) {
      await Promise.all(item.stagedImages.map(remoteImage.deleteStagedImage));
      item.stagedImages = [];
      delete item.data.images;
    }
  }

  await ProductImportRow.insertMany(
    built.map((item, index) => ({
      batch: batchId,
      index,
      lines: item.lines,
      status: item.errors.length ? 'INVALID' : 'VALID',
      action: item.errors.length ? null : item.action,
      existingProduct: item.existing?._id || null,
      existingProductName: item.existing?.name || '',
      issues: item.errors,
      notes: item.notes,
      data: item.data,
      stagedImages: item.stagedImages,
    }))
  );

  const validCount = built.filter((b) => !b.errors.length).length;
  const summary = {
    validCount,
    invalidCount: built.length - validCount,
    processedAt: new Date(),
    status: 'PENDING_REVIEW',
  };

  if (batch.mode === 'PREVIEW') {
    const counts = await createPreviewProducts(batch, scope);
    Object.assign(summary, {
      createdCount: counts.created,
      skippedCount: counts.skipped,
      failedCount: counts.failed,
    });
    if (counts.created === 0) {
      summary.status = 'FAILED';
      summary.errorMessage = counts.skipped
        ? 'No new products: every valid row matched a product that already exists.'
        : 'No product could be added — see the errors for each row.';
    }
  }

  await ProductImport.updateOne({ _id: batchId, status: 'PROCESSING' }, { $set: summary });
}

// PREVIEW mode: every valid row becomes a real product straight away, but as
// a Draft that buyers cannot see (isActive: false) and flagged importPreview.
// The admin reviews, edits or deletes it in the normal product list, and
// approvePreviewProducts is the only thing that makes it live.
async function createPreviewProducts(batch, scope) {
  const settings = await CatalogSettings.getSettings();
  const rows = await ProductImportRow.find({ batch: batch._id, status: 'VALID' }).sort({ index: 1 });
  const counts = { created: 0, skipped: 0, failed: 0 };
  const discard = [];

  for (const row of rows) {
    if (row.action === 'SKIP') {
      row.status = 'SKIPPED';
      row.resultProduct = row.existingProduct;
      row.resultMessage = 'Already in the catalog — not imported';
      counts.skipped += 1;
    } else {
      try {
        const product = await Product.create({
          ...newProductDoc(row.data, scope, settings.autoApprovalEnabled),
          status: 'Draft',
          isActive: false,
          // A seller's preview has not been submitted yet. It only enters the
          // platform's approval queue (which skips importPreview products)
          // once the seller approves it — see approvePreviewProducts.
          ...(scope.ownerType === 'VENDOR' ? { approvalStatus: 'PENDING' } : {}),
          importPreview: true,
          importBatch: batch._id,
        });
        row.status = 'CREATED';
        row.resultProduct = product._id;
        row.resultMessage = 'Added as a preview — approve it from the product list';
        counts.created += 1;
      } catch (err) {
        row.status = 'FAILED';
        row.resultMessage = err?.code === 11000 ? 'SKU is already in use' : 'Could not be saved';
        if (err?.code !== 11000) console.error('[product-import] preview create failed:', err);
        counts.failed += 1;
        discard.push(row);
      }
    }
    await row.save();
  }

  await cleanupImages(discard);
  return counts;
}

// Recomputes a PREVIEW batch once its previews are approved or deleted: it is
// APPROVED when none are left waiting and at least one went live, REJECTED
// when every preview was deleted instead.
async function syncPreviewBatch(batchId, actorName = '') {
  if (!batchId || !mongoose.isValidObjectId(batchId)) return;
  const batch = await ProductImport.findOne({ _id: batchId, mode: 'PREVIEW' });
  if (!batch) return;
  const [waiting, approved] = await Promise.all([
    Product.countDocuments({ importBatch: batchId, importPreview: true }),
    Product.countDocuments({ importBatch: batchId, importPreview: false }),
  ]);
  batch.approvedCount = approved;
  if (waiting === 0 && batch.status === 'PENDING_REVIEW') {
    batch.status = approved > 0 ? 'APPROVED' : 'REJECTED';
    batch.reviewedAt = new Date();
    batch.reviewedByName = actorName;
    if (approved === 0 && !batch.rejectionReason) batch.rejectionReason = 'All imported previews were deleted';
  }
  await batch.save();
}

// Approves the owner's preview products. `all` approves every preview waiting.
//
// Admin: the product goes live. Seller: the product is SUBMITTED — it follows
// the same rule as a product the seller adds by hand
// (vendorProductController.createMyProduct), so it is live straight away only
// when auto-approval is on, and otherwise waits in the platform approval
// queue. Returns { approved, live }.
async function approvePreviewProducts(scope, { productIds, all }) {
  const settings = await CatalogSettings.getSettings();
  if (scope.ownerType === 'ADMIN' && settings.sellerOnlyMode) {
    throw new ImportError('Seller-only catalog mode is on: imported products cannot be approved.', 403);
  }

  const filter = { importPreview: true, vendor: scope.ownerType === 'VENDOR' ? scope.vendorId : null };
  if (!all) {
    const ids = (Array.isArray(productIds) ? productIds : []).filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) throw new ImportError('Select at least one product to approve');
    filter._id = { $in: ids };
  }
  const products = await Product.find(filter).select('_id importBatch').lean();
  if (!products.length) throw new ImportError('There are no imported products waiting for approval');

  const live = scope.ownerType === 'ADMIN' || settings.autoApprovalEnabled;
  await Product.updateMany(
    { _id: { $in: products.map((p) => p._id) }, importPreview: true },
    {
      $set: {
        importPreview: false,
        status: 'Active',
        isActive: live,
        ...(scope.ownerType === 'VENDOR' ? { approvalStatus: live ? 'APPROVED' : 'PENDING' } : {}),
      },
    }
  );

  const batchIds = [...new Set(products.filter((p) => p.importBatch).map((p) => String(p.importBatch)))];
  for (const id of batchIds) await syncPreviewBatch(id, scope.actorName);

  return { approved: products.length, live };
}

// ---------------------------------------------------------------------------
// Stage 2 — review
// ---------------------------------------------------------------------------

async function sweepStale(scope) {
  const cutoff = new Date(Date.now() - STALE_MS);
  await ProductImport.updateMany(
    { ...scopeFilter(scope), status: { $in: ['PROCESSING', 'APPROVING'] }, updatedAt: { $lt: cutoff } },
    { $set: { status: 'FAILED', errorMessage: 'Processing was interrupted. Upload the file again.' } }
  );
}

async function findBatch(scope, batchId) {
  if (!mongoose.isValidObjectId(batchId)) throw new ImportError('Import not found', 404);
  const batch = await ProductImport.findOne({ _id: batchId, ...scopeFilter(scope) });
  if (!batch) throw new ImportError('Import not found', 404);
  return batch;
}

async function listBatches(scope, { page = 1, limit = 20, status } = {}) {
  await sweepStale(scope);
  const filter = { ...scopeFilter(scope) };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ProductImport.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProductImport.countDocuments(filter),
  ]);
  return { items, total };
}

async function getBatch(scope, batchId) {
  await sweepStale(scope);
  const batch = await findBatch(scope, batchId);
  const excludedCount = ['PENDING_REVIEW', 'APPROVING', 'APPROVED'].includes(batch.status)
    ? await ProductImportRow.countDocuments({ batch: batch._id, excluded: true, status: { $ne: 'INVALID' } })
    : 0;
  return { batch, excludedCount };
}

const ROW_FILTERS = {
  valid: { status: 'VALID' },
  invalid: { status: 'INVALID' },
  excluded: { excluded: true },
  created: { status: 'CREATED' },
  updated: { status: 'UPDATED' },
  skipped: { status: 'SKIPPED' },
  failed: { status: 'FAILED' },
};

async function listRows(scope, batchId, { page = 1, limit = 25, filter } = {}) {
  const batch = await findBatch(scope, batchId);
  const query = { batch: batch._id, ...(ROW_FILTERS[filter] || {}) };
  const [items, total] = await Promise.all([
    ProductImportRow.find(query)
      .sort({ index: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProductImportRow.countDocuments(query),
  ]);
  return { batch, items, total };
}

// Include or leave out rows before approving. Invalid rows are always out.
async function setRowsExcluded(scope, batchId, { rowIds, all, excluded }) {
  const batch = await findBatch(scope, batchId);
  if (batch.status !== 'PENDING_REVIEW') throw new ImportError('This import has already been decided', 409);
  const filter = { batch: batch._id, status: 'VALID' };
  if (!all) {
    const ids = (Array.isArray(rowIds) ? rowIds : []).filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) throw new ImportError('Select at least one row');
    filter._id = { $in: ids };
  }
  const result = await ProductImportRow.updateMany(filter, { $set: { excluded: Boolean(excluded) } });
  await ProductImport.updateOne({ _id: batch._id }, { $set: { updatedAt: new Date() } });
  return result.modifiedCount;
}

// ---------------------------------------------------------------------------
// Stage 3 — decision
// ---------------------------------------------------------------------------

async function cleanupImages(rows) {
  const files = rows.flatMap((r) => r.stagedImages || []);
  await Promise.all(files.map(remoteImage.deleteStagedImage));
}

async function rejectBatch(scope, batchId, reason) {
  const batch = await ProductImport.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(batchId) ? batchId : null, ...scopeFilter(scope), status: 'PENDING_REVIEW' },
    {
      $set: {
        status: 'REJECTED',
        rejectionReason: String(reason || '').trim().slice(0, 500),
        reviewedAt: new Date(),
        reviewedByName: scope.actorName || '',
      },
    },
    { returnDocument: 'after' }
  );
  if (!batch) {
    await findBatch(scope, batchId); // 404 if it is not theirs
    throw new ImportError('Only an import waiting for review can be rejected', 409);
  }
  if (batch.mode === 'PREVIEW') {
    // Discard only what is still a preview; anything already approved is a
    // live product now and stays.
    const previews = await Product.find({ importBatch: batch._id, importPreview: true }).select('_id').lean();
    const discarded = new Set(previews.map((p) => String(p._id)));
    await Product.deleteMany({ _id: { $in: previews.map((p) => p._id) } });
    const rows = await ProductImportRow.find({ batch: batch._id }).select('stagedImages resultProduct status').lean();
    await cleanupImages(rows.filter((r) => r.status !== 'CREATED' || discarded.has(String(r.resultProduct))));
    batch.approvedCount = await Product.countDocuments({ importBatch: batch._id, importPreview: false });
    if (batch.approvedCount > 0) batch.status = 'APPROVED';
    await batch.save();
    return batch;
  }

  const rows = await ProductImportRow.find({ batch: batch._id }).select('stagedImages').lean();
  await cleanupImages(rows);
  return batch;
}

// Fields an UPDATE may overwrite — exactly what a CSV column can carry.
const MERGEABLE = [
  'name', 'category', 'brand', 'price', 'salePrice', 'mrp', 'costPrice', 'stock', 'weight', 'dimensions',
  'hsnCode', 'gstRate', 'moq', 'isReturnable', 'shortDescription', 'description', 'images',
];

function newProductDoc(data, scope, autoApprove) {
  const status = data.status || 'Active';
  let isActive;
  let approvalStatus;
  if (scope.ownerType === 'VENDOR') {
    // Same rules as a seller creating a product by hand
    // (vendorProductController.createMyProduct): approval still goes through
    // the admin queue unless auto-approval is on.
    approvalStatus = autoApprove && status !== 'Draft' ? 'APPROVED' : 'PENDING';
    isActive = status === 'Active' && autoApprove;
  } else {
    approvalStatus = 'APPROVED';
    isActive = status === 'Active';
  }

  return {
    name: data.name,
    sku: data.sku,
    category: data.category,
    brand: data.brand || null,
    vendor: scope.ownerType === 'VENDOR' ? scope.vendorId : null,
    price: data.price,
    salePrice: data.salePrice ?? null,
    mrp: data.mrp ?? null,
    costPrice: data.costPrice ?? null,
    stock: data.stock ?? 0,
    weight: data.weight,
    dimensions: data.dimensions || null,
    hsnCode: data.hsnCode || '',
    gstRate: data.gstRate ?? null,
    moq: data.moq ?? 1,
    variants: data.variants || [],
    images: data.images || [],
    shortDescription: data.shortDescription || '',
    description: data.description || '',
    status,
    isActive,
    approvalStatus,
    isReturnable: data.isReturnable ?? true,
  };
}

// Variants merge by SKU, then by name: a matched variant keeps its _id (so
// carts and orders pointing at it stay valid) and only the filled fields
// change; unmatched ones are appended; ones not in the file are left alone.
function mergeVariants(product, incoming) {
  for (const v of incoming) {
    const match = product.variants.find(
      (existing) =>
        (v.sku && existing.sku && existing.sku.toLowerCase() === v.sku.toLowerCase()) ||
        existing.name.toLowerCase() === v.name.toLowerCase()
    );
    if (!match) {
      product.variants.push(v);
      continue;
    }
    match.name = v.name;
    if (Object.keys(v.attributes || {}).length) match.attributes = v.attributes;
    if (v.sku) match.sku = v.sku;
    if (v.price !== null) match.price = v.price;
    if (v.salePrice !== null) match.salePrice = v.salePrice;
    match.stock = v.stock;
    if (v.weight !== null) match.weight = v.weight;
    if (v.image) match.image = v.image;
  }
}

function applyUpdate(product, data, scope) {
  for (const key of MERGEABLE) {
    if (data[key] !== undefined) product[key] = data[key];
  }
  if (data.variants?.length) {
    mergeVariants(product, data.variants);
    const error = validateVariants(product.variants.map((v) => ({ ...v.toObject?.() ?? v })));
    if (error) throw new ImportError(error);
  }
  if (data.status) {
    product.status = data.status;
    product.isActive =
      data.status === 'Active' && (scope.ownerType === 'ADMIN' || product.approvalStatus === 'APPROVED');
  }
  if (product.salePrice !== null && product.salePrice > product.price) {
    throw new ImportError('salePrice would be higher than the price');
  }
}

async function approveBatch(scope, batchId) {
  const found = await findBatch(scope, batchId);
  if (found.mode === 'PREVIEW') {
    throw new ImportError('These products are already in the product list as previews — approve them there', 409);
  }
  if (found.status !== 'PENDING_REVIEW') throw new ImportError('This import has already been decided', 409);

  const settings = await CatalogSettings.getSettings();
  if (scope.ownerType === 'ADMIN' && settings.sellerOnlyMode) {
    throw new ImportError('Seller-only catalog mode is on: admin imports cannot be approved.', 403);
  }

  const selectable = await ProductImportRow.countDocuments({ batch: batchId, status: 'VALID', excluded: false });
  if (selectable === 0) throw new ImportError('No valid rows are selected for import');

  // The status flip is the lock: a second click (or a second tab) finds the
  // batch no longer PENDING_REVIEW and stops here.
  const batch = await ProductImport.findOneAndUpdate(
    { _id: batchId, ...scopeFilter(scope), status: 'PENDING_REVIEW' },
    { $set: { status: 'APPROVING' } },
    { returnDocument: 'after' }
  );
  if (!batch) throw new ImportError('This import has already been decided', 409);

  const rows = await ProductImportRow.find({ batch: batch._id }).sort({ index: 1 });
  const toImport = rows.filter((r) => r.status === 'VALID' && !r.excluded);

  // Re-read the catalog: time has passed since the preview, and a category
  // may have been disabled or a SKU taken in between.
  const lookups = await loadLookups(scope, toImport.map((r) => r.data.sku).filter(Boolean));
  const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const discard = [];

  for (const row of toImport) {
    const data = row.data || {};
    try {
      if (data.category && !lookups.categoryById.has(String(data.category))) {
        throw new ImportError(`category "${data.categoryName}" is no longer available`);
      }
      if (data.brand && !lookups.brandById.has(String(data.brand))) {
        throw new ImportError(`brand "${data.brandName}" is no longer available`);
      }
      const current = lookups.existingBySku.get(data.sku);

      if (row.action === 'SKIP') {
        row.status = 'SKIPPED';
        row.resultMessage = 'Already in the catalog';
        row.resultProduct = current?._id || row.existingProduct;
        counts.skipped += 1;
        discard.push(row);
      } else if (row.action === 'CREATE') {
        if (current) throw new ImportError(`SKU "${data.sku}" was taken after this file was previewed`);
        const product = await Product.create(newProductDoc(data, scope, settings.autoApprovalEnabled));
        row.status = 'CREATED';
        row.resultProduct = product._id;
        row.resultMessage =
          product.approvalStatus === 'PENDING' ? 'Created — waiting for admin approval' : 'Created';
        counts.created += 1;
      } else if (row.action === 'UPDATE') {
        const ownerMatch = scope.ownerType === 'VENDOR' ? { vendor: scope.vendorId } : { vendor: null };
        const product = await Product.findOne({ _id: row.existingProduct, sku: data.sku, ...ownerMatch });
        if (!product) throw new ImportError('The product this row would update no longer exists');
        applyUpdate(product, data, scope);
        await product.save();
        row.status = 'UPDATED';
        row.resultProduct = product._id;
        row.resultMessage = 'Existing product updated';
        counts.updated += 1;
      }
    } catch (err) {
      row.status = 'FAILED';
      row.resultMessage =
        err instanceof ImportError
          ? err.message
          : err?.code === 11000
            ? 'SKU was taken while this import was running'
            : 'Could not be saved';
      if (!(err instanceof ImportError)) console.error('[product-import] row failed:', err);
      counts.failed += 1;
      discard.push(row);
    }
    await row.save();
  }

  // Invalid and deselected rows are staying out of the catalog for good.
  discard.push(...rows.filter((r) => r.status === 'INVALID' || r.excluded));
  await cleanupImages(discard);

  const wrote = counts.created + counts.updated;
  batch.status = wrote > 0 || counts.skipped > 0 ? 'APPROVED' : 'FAILED';
  if (batch.status === 'FAILED') batch.errorMessage = 'None of the selected rows could be imported';
  batch.createdCount = counts.created;
  batch.updatedCount = counts.updated;
  batch.skippedCount = counts.skipped;
  batch.failedCount = counts.failed;
  batch.reviewedAt = new Date();
  batch.reviewedByName = scope.actorName || '';
  await batch.save();

  return {
    batch,
    message:
      `${plural(counts.created, 'product')} created, ${counts.updated} updated` +
      (counts.skipped ? `, ${counts.skipped} skipped` : '') +
      (counts.failed ? `, ${counts.failed} failed` : ''),
  };
}

module.exports = {
  ImportError,
  buildTemplateCsv,
  stageImport,
  processBatch,
  listBatches,
  getBatch,
  listRows,
  setRowsExcluded,
  approveBatch,
  rejectBatch,
  approvePreviewProducts,
  syncPreviewBatch,
};
