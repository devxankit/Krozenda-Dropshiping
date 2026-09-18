const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const Brand = require('../Models/Brand');
const CatalogSettings = require('../Models/CatalogSettings');
const { parseCsv, toCsv } = require('../utils/csv');

// Bulk product upload for sellers.
//
// The design rule this whole file follows: a bad row must never take a good
// row down with it, and the seller must be told exactly which row failed and
// why. A 400 that says "invalid file" against a 300-row upload is useless —
// they have no way to find the one bad cell.
//
// So: every row is validated independently, the valid ones are written, and
// the response is a per-row report the UI renders as a table. `dryRun` gives
// the seller that report WITHOUT writing anything, which is what the import
// screen calls first.

// Hard cap. Well above a realistic single upload, and low enough that one
// request cannot sit there writing for minutes.
const MAX_ROWS = 500;

const COLUMNS = [
  { key: 'name', label: 'name', required: true, help: 'Product title' },
  { key: 'category', label: 'category', required: true, help: 'Category name, exactly as it appears in your panel' },
  { key: 'brand', label: 'brand', required: false, help: 'Brand name, or leave blank' },
  { key: 'sku', label: 'sku', required: false, help: 'Your own code. Must be unique across the platform' },
  { key: 'price', label: 'price', required: true, help: 'Regular price in rupees' },
  { key: 'salePrice', label: 'salePrice', required: false, help: 'Discounted price, must be below price' },
  { key: 'stock', label: 'stock', required: false, help: 'Units available. Defaults to 0' },
  { key: 'weight', label: 'weight', required: false, help: 'Shipping weight in kg' },
  { key: 'hsnCode', label: 'hsnCode', required: false, help: '4 to 8 digits' },
  { key: 'gstRate', label: 'gstRate', required: false, help: 'One of 0, 5, 12, 18, 28' },
  { key: 'moq', label: 'moq', required: false, help: 'Minimum order quantity. Defaults to 1' },
  { key: 'description', label: 'description', required: false, help: '' },
];

const GST_SLABS = [0, 5, 12, 18, 28];

function toNumber(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

// Validates one row against the catalog the seller can actually use. Returns
// { error } or { doc }. Lookups are done from pre-built maps rather than a
// query per row — a 300-row upload would otherwise be 600 round trips.
function buildRow(row, { categoryByName, brandByName, seenSkus, existingSkus, autoApprove, vendorId }) {
  const name = String(row.name || '').trim();
  if (!name) return { error: 'name is required' };

  const categoryName = String(row.category || '').trim().toLowerCase();
  if (!categoryName) return { error: 'category is required' };
  const category = categoryByName.get(categoryName);
  if (!category) return { error: `category "${row.category}" not found — use a category from your panel` };

  let brand = null;
  const brandName = String(row.brand || '').trim().toLowerCase();
  if (brandName) {
    brand = brandByName.get(brandName);
    if (!brand) return { error: `brand "${row.brand}" not found` };
  }

  const price = toNumber(row.price);
  if (price === null) return { error: 'price is required' };
  if (Number.isNaN(price) || price < 0) return { error: `price "${row.price}" is not a valid amount` };

  const salePrice = toNumber(row.salePrice);
  if (Number.isNaN(salePrice)) return { error: `salePrice "${row.salePrice}" is not a valid amount` };
  if (salePrice !== null && salePrice > price) return { error: 'salePrice cannot be higher than price' };

  const stock = toNumber(row.stock);
  if (Number.isNaN(stock)) return { error: `stock "${row.stock}" is not a number` };

  const weight = toNumber(row.weight);
  if (Number.isNaN(weight)) return { error: `weight "${row.weight}" is not a number` };

  const gstRate = toNumber(row.gstRate);
  if (Number.isNaN(gstRate)) return { error: `gstRate "${row.gstRate}" is not a number` };
  if (gstRate !== null && !GST_SLABS.includes(gstRate)) {
    return { error: `gstRate must be one of ${GST_SLABS.join(', ')}` };
  }

  const hsnCode = String(row.hsnCode || '').trim();
  if (hsnCode && !/^\d{4,8}$/.test(hsnCode)) return { error: 'hsnCode must be 4 to 8 digits' };

  const moq = toNumber(row.moq);
  if (Number.isNaN(moq)) return { error: `moq "${row.moq}" is not a number` };
  if (moq !== null && (moq < 1 || !Number.isInteger(moq))) {
    return { error: 'moq must be a whole number of at least 1' };
  }

  const sku = String(row.sku || '').trim();
  if (sku) {
    // Two kinds of collision, and they need different wording: against the
    // database, and against another row in this same file.
    if (existingSkus.has(sku)) return { error: `SKU "${sku}" is already in use` };
    if (seenSkus.has(sku)) return { error: `SKU "${sku}" appears twice in this file` };
    seenSkus.add(sku);
  }

  return {
    doc: {
      name,
      ...(sku ? { sku } : {}),
      category: category._id,
      brand: brand ? brand._id : null,
      vendor: vendorId,
      price,
      salePrice,
      stock: Math.max(0, Math.round(stock ?? 0)),
      weight,
      hsnCode,
      gstRate,
      moq: Math.max(1, Math.round(moq ?? 1)),
      description: String(row.description || '').trim(),
      isActive: autoApprove,
      approvalStatus: autoApprove ? 'APPROVED' : 'PENDING',
    },
  };
}

// GET /vendor/products/import/template — a CSV with the header row and one
// worked example, so a seller starts from something that imports cleanly
// rather than guessing at column names.
async function getImportTemplate(req, res) {
  const headers = COLUMNS.map((c) => c.label);
  const example = {
    name: 'Organic Cotton Tee',
    category: 'Apparel',
    brand: '',
    sku: 'ORG-TEE-001',
    price: '799',
    salePrice: '649',
    stock: '120',
    weight: '0.25',
    hsnCode: '6109',
    gstRate: '5',
    moq: '1',
    description: 'Soft combed cotton, pre-shrunk',
  };

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="krozenda-product-import-template.csv"');
  res.send(toCsv(headers, [example]));
}

// POST /vendor/products/import
//
// `dryRun=true` validates and reports without writing. The import screen
// always calls that first, so a seller sees what will happen before it does.
async function importProducts(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Attach a CSV file to import' });
  }

  const dryRun = req.body?.dryRun === 'true' || req.body?.dryRun === true;

  let parsed;
  try {
    parsed = parseCsv(req.file.buffer.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'That file could not be read as CSV' });
  }

  if (parsed.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'The file has a header row but no products' });
  }
  if (parsed.rows.length > MAX_ROWS) {
    return res.status(400).json({
      success: false,
      message: `That file has ${parsed.rows.length} rows. Split it into uploads of ${MAX_ROWS} or fewer.`,
    });
  }

  const missingColumns = COLUMNS.filter((c) => c.required && !parsed.headers.includes(c.label)).map((c) => c.label);
  if (missingColumns.length > 0) {
    return res.status(400).json({
      success: false,
      message: `The file is missing required columns: ${missingColumns.join(', ')}. Download the template to see the expected format.`,
    });
  }

  // Everything the rows can legally refer to, fetched once.
  const [categories, brands, settings] = await Promise.all([
    Category.find({ isActive: true }).select('name').lean(),
    Brand.find({ isActive: true }).select('name').lean(),
    CatalogSettings.getSettings(),
  ]);

  const skusInFile = parsed.rows.map((r) => String(r.sku || '').trim()).filter(Boolean);
  const existing = skusInFile.length
    ? await Product.find({ sku: { $in: skusInFile } }).select('sku').lean()
    : [];

  const context = {
    categoryByName: new Map(categories.map((c) => [c.name.trim().toLowerCase(), c])),
    brandByName: new Map(brands.map((b) => [b.name.trim().toLowerCase(), b])),
    seenSkus: new Set(),
    existingSkus: new Set(existing.map((p) => p.sku)),
    autoApprove: settings.autoApprovalEnabled,
    vendorId: req.vendor._id,
  };

  const failures = [];
  const pending = [];

  for (const row of parsed.rows) {
    const result = buildRow(row, context);
    if (result.error) {
      failures.push({ line: row.__line, name: row.name || '', error: result.error });
    } else {
      pending.push({ line: row.__line, doc: result.doc });
    }
  }

  if (dryRun) {
    return res.json({
      success: true,
      message: `${pending.length} row${pending.length === 1 ? '' : 's'} ready, ${failures.length} with problems`,
      data: {
        dryRun: true,
        totalRows: parsed.rows.length,
        created: 0,
        readyCount: pending.length,
        failed: failures,
        willAutoApprove: context.autoApprove,
      },
    });
  }

  // Written one at a time, not with insertMany. insertMany would skip the
  // pre-save hook that assigns each product its barcode, and an ordered
  // insertMany stops at the first failure — both of which defeat the point of
  // a per-row report.
  const created = [];
  for (const { line, doc } of pending) {
    try {
      const product = await Product.create(doc);
      created.push({ line, id: product._id.toString(), name: product.name });
    } catch (err) {
      // A race on a unique index is the realistic case here: the SKU was free
      // when it was checked above and taken by the time it was written.
      failures.push({
        line,
        name: doc.name,
        error: err?.code === 11000 ? 'SKU was taken while this import was running' : 'Could not be saved',
      });
    }
  }

  res.status(created.length > 0 ? 201 : 400).json({
    success: created.length > 0,
    message:
      created.length > 0
        ? `Imported ${created.length} product${created.length === 1 ? '' : 's'}${failures.length ? `, ${failures.length} skipped` : ''}`
        : 'No products could be imported — see the errors below',
    data: {
      dryRun: false,
      totalRows: parsed.rows.length,
      created: created.length,
      readyCount: created.length,
      createdItems: created,
      failed: failures.sort((a, b) => a.line - b.line),
      willAutoApprove: context.autoApprove,
    },
  });
}

module.exports = { importProducts, getImportTemplate, COLUMNS, MAX_ROWS };
