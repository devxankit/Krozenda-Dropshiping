const mongoose = require('mongoose');
const { validateVariants } = require('../../utils/productVariants');

// Column definitions and per-product validation for CSV product imports.
// Pure: no database or network access, so every rule here can be tested with
// plain objects. The service (importService.js) supplies the lookups.

const MAX_ROWS = 500;
const MAX_IMAGES = 8;
const GST_SLABS = [0, 5, 12, 18, 28];
const STATUSES = { active: 'Active', draft: 'Draft', inactive: 'Inactive' };

// `aliases` are compared after lowercasing and stripping everything that is
// not a letter or digit, so "Sale Price", "sale_price" and "salePrice" all
// land on the same field. `level` says whether a column describes the product
// (read from its first line) or one variant (read from every line).
const COLUMNS = [
  { key: 'name', aliases: ['name', 'productname', 'title'], required: true, level: 'product', help: 'Product title', example: 'Organic Cotton Tee' },
  { key: 'sku', aliases: ['sku', 'productsku'], required: true, level: 'product', help: 'Unique product code. Repeat it on extra lines to add variants; it is also how existing products are matched', example: 'ORG-TEE-001' },
  { key: 'category', aliases: ['category', 'categoryname'], required: true, level: 'product', help: 'Category name exactly as it appears in the panel (or its ID)', example: 'Apparel' },
  { key: 'brand', aliases: ['brand', 'brandname'], level: 'product', help: 'Brand name, or leave blank', example: '' },
  { key: 'price', aliases: ['price', 'regularprice'], required: true, level: 'product', help: 'Regular price in rupees', example: '799' },
  { key: 'salePrice', aliases: ['saleprice', 'sellingprice', 'discountprice'], level: 'product', help: 'Discounted price, must not exceed price', example: '649' },
  { key: 'mrp', aliases: ['mrp'], level: 'product', help: 'Maximum retail price', example: '999' },
  { key: 'costPrice', aliases: ['costprice', 'cost'], level: 'product', help: 'Your purchase cost (never shown to buyers)', example: '' },
  { key: 'stock', aliases: ['stock', 'quantity', 'qty'], level: 'product', help: 'Units available. Defaults to 0', example: '120' },
  { key: 'weight', aliases: ['weight', 'weightkg'], level: 'product', help: 'Shipping weight in kg, required for new products', example: '0.25' },
  { key: 'lengthCm', aliases: ['length', 'lengthcm'], level: 'product', help: 'Package length in cm (all three or none)', example: '' },
  { key: 'breadthCm', aliases: ['breadth', 'breadthcm', 'width', 'widthcm'], level: 'product', help: 'Package breadth in cm', example: '' },
  { key: 'heightCm', aliases: ['height', 'heightcm'], level: 'product', help: 'Package height in cm', example: '' },
  { key: 'hsnCode', aliases: ['hsn', 'hsncode'], level: 'product', help: '4 to 8 digits', example: '6109' },
  { key: 'gstRate', aliases: ['gst', 'gstrate'], level: 'product', help: 'One of 0, 5, 12, 18, 28', example: '5' },
  { key: 'moq', aliases: ['moq', 'minimumorderquantity'], level: 'product', help: 'Minimum order quantity. Defaults to 1', example: '1' },
  { key: 'status', aliases: ['status'], level: 'product', help: 'Active, Draft or Inactive. Defaults to Active', example: 'Active' },
  { key: 'isReturnable', aliases: ['returnable', 'isreturnable'], level: 'product', help: 'yes or no. Defaults to yes', example: 'yes' },
  { key: 'shortDescription', aliases: ['shortdescription'], level: 'product', help: '', example: 'Everyday crew-neck tee' },
  { key: 'description', aliases: ['description', 'productdescription'], level: 'product', help: '', example: 'Soft combed cotton, pre-shrunk' },
  { key: 'images', aliases: ['images', 'image', 'imageurl', 'imageurls'], level: 'product', help: `Public image URLs separated by | (up to ${MAX_IMAGES}). Required for new products`, example: 'https://example.com/tee-front.jpg|https://example.com/tee-back.jpg' },
  { key: 'variantName', aliases: ['variantname', 'variant'], level: 'variant', help: 'Fill to make this line a variant, e.g. "Red / L"', example: 'Red / L' },
  { key: 'variantAttributes', aliases: ['variantattributes', 'attributes'], level: 'variant', help: 'e.g. Color:Red|Size:L', example: 'Color:Red|Size:L' },
  { key: 'variantSku', aliases: ['variantsku'], level: 'variant', help: '', example: 'ORG-TEE-001-RL' },
  { key: 'variantPrice', aliases: ['variantprice'], level: 'variant', help: 'Blank = same as the product', example: '' },
  { key: 'variantSalePrice', aliases: ['variantsaleprice'], level: 'variant', help: '', example: '' },
  { key: 'variantStock', aliases: ['variantstock', 'variantquantity'], level: 'variant', help: '', example: '40' },
  { key: 'variantWeight', aliases: ['variantweight'], level: 'variant', help: 'kg. Blank = same as the product', example: '' },
  { key: 'variantImage', aliases: ['variantimage', 'variantimageurl'], level: 'variant', help: 'One public image URL', example: '' },
];

const VARIANT_KEYS = COLUMNS.filter((c) => c.level === 'variant').map((c) => c.key);

function headerKey(header) {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ALIAS_TO_KEY = new Map();
for (const column of COLUMNS) {
  for (const alias of column.aliases) ALIAS_TO_KEY.set(alias, column.key);
}

// Maps whatever headers the file has onto field keys. "image1", "image2"...
// columns are folded into `images`, which is how many spreadsheet exports
// lay photos out.
function mapHeaders(headers) {
  const mapping = new Map(); // original header -> key
  const unknown = [];
  for (const header of headers) {
    const normalised = headerKey(header);
    if (!normalised) continue;
    if (ALIAS_TO_KEY.has(normalised)) mapping.set(header, ALIAS_TO_KEY.get(normalised));
    else if (/^image(url)?\d+$/.test(normalised)) mapping.set(header, 'images');
    else unknown.push(header);
  }
  const present = new Set(mapping.values());
  const missing = COLUMNS.filter((c) => c.required && !present.has(c.key)).map((c) => c.key);
  return { mapping, missing, unknown };
}

function normaliseRecord(record, mapping) {
  const out = { __line: record.__line };
  for (const [header, key] of mapping) {
    const value = String(record[header] ?? '').trim();
    if (key === 'images') {
      out.images = out.images ? `${out.images}|${value}` : value;
    } else if (!out[key]) {
      out[key] = value;
    }
  }
  return out;
}

// Consecutive or not, lines sharing a SKU are one product. Lines with no SKU
// stay on their own so they can be reported individually.
function groupRecords(records) {
  const groups = [];
  const bySku = new Map();
  for (const record of records) {
    const sku = String(record.sku || '').trim();
    if (sku && bySku.has(sku)) {
      bySku.get(sku).push(record);
      continue;
    }
    const group = [record];
    groups.push(group);
    if (sku) bySku.set(sku, group);
  }
  return groups;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function parseNumber(raw) {
  if (isBlank(raw)) return null;
  const n = Number(String(raw).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function parseBool(raw) {
  const v = String(raw).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0'].includes(v)) return false;
  return undefined;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function splitUrls(raw) {
  return String(raw || '')
    .split(/[|\n\r\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// "Color:Red|Size:L" (or "Color=Red; Size=L") -> { Color: 'Red', Size: 'L' }
function parseAttributes(raw) {
  const out = {};
  for (const pair of String(raw || '').split(/[|;]/)) {
    const match = pair.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/);
    if (!match) continue;
    const [, name, value] = match;
    if (name.includes('.') || name.startsWith('$')) continue;
    out[name] = value;
  }
  return out;
}

// Reads one number field, recording an error when the cell is filled but
// wrong. Returns undefined for a blank cell so "not provided" stays distinct
// from zero.
function numberField(record, key, label, errors, { min = 0, integer = false } = {}) {
  const value = parseNumber(record[key]);
  if (value === null) return undefined;
  if (Number.isNaN(value)) {
    errors.push(`${label} "${record[key]}" is not a number`);
    return undefined;
  }
  if (value < min) {
    errors.push(`${label} cannot be less than ${min}`);
    return undefined;
  }
  if (integer && !Number.isInteger(value)) {
    errors.push(`${label} must be a whole number`);
    return undefined;
  }
  return value;
}

// Validates one product group and decides what approval would do with it.
//
// ctx: {
//   categoryByName, categoryById, brandByName, brandById: Maps
//   existingBySku: Map sku -> { _id, name, vendor, fulfillmentProvider }
//   ownerType: 'ADMIN' | 'VENDOR', vendorId, duplicateMode: 'SKIP' | 'UPDATE'
//   seenVariantSkus?: not needed — variant SKUs are checked per product
// }
//
// Returns { lines, errors, notes, action, existing, data, imageUrls, variantImageUrls }
function buildProduct(group, ctx) {
  const first = group[0];
  const lines = group.map((r) => r.__line);
  const errors = [];
  const notes = [];
  const data = {};

  const name = String(first.name || '').trim();
  const sku = String(first.sku || '').trim();

  if (name) {
    if (name.length > 200) errors.push('name is longer than 200 characters');
    data.name = name;
  }

  if (!sku) errors.push('sku is required');
  else if (sku.length > 64) errors.push('sku is longer than 64 characters');
  else data.sku = sku;

  // --- duplicate handling ---------------------------------------------------
  let action = 'CREATE';
  let existing = null;
  if (data.sku && ctx.existingBySku.has(data.sku)) {
    existing = ctx.existingBySku.get(data.sku);
    const ownedByScope =
      ctx.ownerType === 'VENDOR'
        ? existing.vendor && String(existing.vendor) === String(ctx.vendorId)
        : !existing.vendor;
    if (existing.fulfillmentProvider === 'CJ') {
      errors.push(`SKU "${sku}" belongs to a CJ dropshipping product, which is managed from the CJ screens`);
    } else if (!ownedByScope) {
      errors.push(
        ctx.ownerType === 'VENDOR'
          ? `SKU "${sku}" is already used by another listing on the platform`
          : `SKU "${sku}" belongs to a seller's product — sellers manage their own listings`
      );
    } else if (ctx.duplicateMode === 'UPDATE') {
      action = 'UPDATE';
      notes.push(`Will update your existing product "${existing.name}"`);
    } else {
      action = 'SKIP';
      notes.push(`Already in your catalog as "${existing.name}" — will be skipped. Choose "Update existing" to merge instead.`);
    }
  }
  const isCreate = action === 'CREATE';

  if (!name && isCreate) errors.push('name is required');

  // --- category & brand -----------------------------------------------------
  const categoryRaw = String(first.category || '').trim();
  if (categoryRaw) {
    const category =
      (mongoose.isValidObjectId(categoryRaw) && ctx.categoryById.get(categoryRaw)) ||
      ctx.categoryByName.get(categoryRaw.toLowerCase());
    if (!category) errors.push(`category "${categoryRaw}" not found — use a category from the panel`);
    else {
      data.category = String(category._id);
      data.categoryName = category.name;
    }
  } else if (isCreate) {
    errors.push('category is required');
  }

  const brandRaw = String(first.brand || '').trim();
  if (brandRaw) {
    const brand =
      (mongoose.isValidObjectId(brandRaw) && ctx.brandById.get(brandRaw)) || ctx.brandByName.get(brandRaw.toLowerCase());
    if (!brand) errors.push(`brand "${brandRaw}" not found`);
    else {
      data.brand = String(brand._id);
      data.brandName = brand.name;
    }
  }

  // --- pricing, stock, shipping ---------------------------------------------
  const price = numberField(first, 'price', 'price', errors);
  if (price !== undefined) data.price = price;
  else if (isCreate && isBlank(first.price)) errors.push('price is required');

  const salePrice = numberField(first, 'salePrice', 'salePrice', errors);
  if (salePrice !== undefined) {
    const against = price ?? existing?.price;
    if (against !== undefined && against !== null && salePrice > against) {
      errors.push('salePrice cannot be higher than price');
    } else data.salePrice = salePrice;
  }

  const mrp = numberField(first, 'mrp', 'mrp', errors);
  if (mrp !== undefined) {
    data.mrp = mrp;
    if (price !== undefined && mrp < price) notes.push('mrp is lower than price');
  }
  const costPrice = numberField(first, 'costPrice', 'costPrice', errors);
  if (costPrice !== undefined) data.costPrice = costPrice;

  const stock = numberField(first, 'stock', 'stock', errors, { integer: true });
  if (stock !== undefined) data.stock = stock;

  const weight = numberField(first, 'weight', 'weight', errors);
  if (weight !== undefined) {
    if (weight <= 0) errors.push('weight must be greater than 0 kg');
    else data.weight = weight;
  } else if (isCreate && isBlank(first.weight)) {
    errors.push('weight (kg) is required');
  }

  const dims = ['lengthCm', 'breadthCm', 'heightCm'].map((key) => numberField(first, key, key, errors));
  const filledDims = dims.filter((d) => d !== undefined).length;
  if (filledDims === 3) data.dimensions = { lengthCm: dims[0], breadthCm: dims[1], heightCm: dims[2] };
  else if (filledDims > 0) errors.push('give all three of length, breadth and height, or none');

  // --- tax & B2B ------------------------------------------------------------
  const hsnCode = String(first.hsnCode || '').trim();
  if (hsnCode) {
    if (!/^\d{4,8}$/.test(hsnCode)) errors.push('hsnCode must be 4 to 8 digits');
    else data.hsnCode = hsnCode;
  }

  const gstRate = numberField(first, 'gstRate', 'gstRate', errors);
  if (gstRate !== undefined) {
    if (!GST_SLABS.includes(gstRate)) errors.push(`gstRate must be one of ${GST_SLABS.join(', ')}`);
    else data.gstRate = gstRate;
  }

  const moq = numberField(first, 'moq', 'moq', errors, { min: 1, integer: true });
  if (moq !== undefined) data.moq = moq;

  // --- flags & text ---------------------------------------------------------
  if (!isBlank(first.status)) {
    const status = STATUSES[String(first.status).trim().toLowerCase()];
    if (!status) errors.push(`status "${first.status}" must be Active, Draft or Inactive`);
    else data.status = status;
  }

  if (!isBlank(first.isReturnable)) {
    const returnable = parseBool(first.isReturnable);
    if (returnable === undefined) errors.push(`returnable "${first.isReturnable}" must be yes or no`);
    else data.isReturnable = returnable;
  }

  if (!isBlank(first.shortDescription)) {
    const short = String(first.shortDescription).trim();
    if (short.length > 500) errors.push('shortDescription is longer than 500 characters');
    else data.shortDescription = short;
  }
  if (!isBlank(first.description)) {
    const description = String(first.description).trim();
    if (description.length > 20000) errors.push('description is longer than 20,000 characters');
    else data.description = description;
  }

  // --- images ---------------------------------------------------------------
  const imageUrls = [...new Set(splitUrls(first.images))];
  const badUrls = imageUrls.filter((u) => !isHttpUrl(u));
  if (badUrls.length) errors.push(`image URL "${badUrls[0]}" is not a valid http(s) link`);
  if (imageUrls.length > MAX_IMAGES) errors.push(`at most ${MAX_IMAGES} images per product (found ${imageUrls.length})`);
  if (imageUrls.length === 0 && isCreate) errors.push('at least one image URL is required');

  // --- variants -------------------------------------------------------------
  const variantImageUrls = [];
  const variants = [];
  const hasVariantData = (r) => VARIANT_KEYS.some((k) => !isBlank(r[k]));
  if (group.length > 1 && group.some((r) => isBlank(r.variantName))) {
    errors.push(
      `SKU "${sku}" appears on lines ${lines.join(', ')} — repeat a SKU only on variant lines, each with a variantName`
    );
  }
  for (const record of group) {
    if (!hasVariantData(record)) continue;
    const line = record.__line;
    const variantName = String(record.variantName || '').trim();
    if (!variantName) {
      errors.push(`line ${line}: variant columns are filled but variantName is blank`);
      continue;
    }
    const variantErrors = [];
    const variant = {
      name: variantName,
      attributes: parseAttributes(record.variantAttributes),
      sku: String(record.variantSku || '').trim(),
      price: numberField(record, 'variantPrice', 'variantPrice', variantErrors) ?? null,
      salePrice: numberField(record, 'variantSalePrice', 'variantSalePrice', variantErrors) ?? null,
      stock: numberField(record, 'variantStock', 'variantStock', variantErrors, { integer: true }) ?? 0,
      weight: numberField(record, 'variantWeight', 'variantWeight', variantErrors) ?? null,
      image: null,
    };
    const variantImage = String(record.variantImage || '').trim();
    if (variantImage) {
      if (!isHttpUrl(variantImage)) variantErrors.push(`variantImage "${variantImage}" is not a valid http(s) link`);
      else variantImageUrls.push({ index: variants.length, url: variantImage });
    }
    errors.push(...variantErrors.map((e) => `line ${line} (${variantName}): ${e}`));
    variants.push(variant);
  }
  if (variants.length) {
    const seen = new Set();
    for (const v of variants) {
      const key = v.name.toLowerCase();
      if (seen.has(key)) errors.push(`variant "${v.name}" is listed twice`);
      seen.add(key);
    }
    const variantError = validateVariants(variants);
    if (variantError) errors.push(variantError);
    data.variants = variants;
    // A product with variants sells from each variant's stock; the parent
    // figure is only a total for the listing screens.
    if (data.stock === undefined && isCreate) data.stock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  }

  return {
    lines,
    errors,
    notes,
    action: errors.length ? null : action,
    existing,
    data,
    imageUrls: badUrls.length ? [] : imageUrls.slice(0, MAX_IMAGES),
    variantImageUrls,
  };
}

module.exports = {
  COLUMNS,
  MAX_ROWS,
  MAX_IMAGES,
  mapHeaders,
  normaliseRecord,
  groupRecords,
  buildProduct,
  parseAttributes,
  splitUrls,
};
