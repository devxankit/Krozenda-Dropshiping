const mongoose = require('mongoose');

// Variant parsing and validation shared by the admin product controller and
// the seller panel's, so an admin and a seller can never disagree about what
// a valid variant is.

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRelativePath(url) {
  const index = url.indexOf('/uploads/');
  return index === -1 ? url : url.slice(index);
}

// { Color: 'Black', Size: 'XL' }. Keys become Mongo Map keys, which may not
// contain "." or start with "$" — those are dropped rather than failing the save.
function normaliseAttributes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key).trim();
    const val = String(value ?? '').trim();
    if (!name || !val || name.includes('.') || name.startsWith('$')) continue;
    out[name] = val;
  }
  return out;
}

// Replaced wholesale when sent, never merged: the form owns the list, and a
// merge would make removing a variant impossible. An existing variant keeps
// its _id (and therefore its identity on live carts and orders) when the
// client sends it back.
function normaliseVariants(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((v) => v && String(v.name || '').trim())
    .map((v) => ({
      ...(v.id && mongoose.isValidObjectId(v.id) ? { _id: v.id } : {}),
      name: String(v.name).trim(),
      attributes: normaliseAttributes(v.attributes),
      sku: String(v.sku || '').trim(),
      price: toNumber(v.price),
      salePrice: toNumber(v.salePrice),
      costPrice: toNumber(v.costPrice),
      stock: Math.max(0, Math.round(toNumber(v.stock, 0))),
      weight: toNumber(v.weight),
      image: v.image || null,
      isActive: v.isActive !== false,
    }));
}

function validateVariants(variants) {
  if (!Array.isArray(variants)) return null;
  const skus = new Set();
  for (const v of variants) {
    if (v.price !== null && v.price < 0) return `Option "${v.name}" has a negative price`;
    if (v.salePrice !== null && v.price !== null && v.salePrice > v.price) {
      return `Option "${v.name}": selling price cannot be higher than its MRP`;
    }
    if (v.weight !== null && v.weight <= 0) return `Option "${v.name}": weight must be greater than 0 kg`;
    if (v.sku) {
      const key = v.sku.toLowerCase();
      if (skus.has(key)) return `Two options share the SKU ${v.sku}`;
      skus.add(key);
    }
  }
  return null;
}

// A variant's `image` arrives as either a URL the form already had, or
// "new:<n>" — the n-th file uploaded in this same request, which had no URL
// until multer wrote it. A photo removed from the gallery in the same save is
// cleared off any option pointing at it. Other URLs are kept even when they
// are not in the gallery: CJ-onboarded variants carry their own image.
function resolveVariantImages(variants, newImages, removed = new Set()) {
  for (const v of variants) {
    const ref = v.image ? String(v.image) : '';
    if (ref.startsWith('new:')) {
      v.image = newImages[Number(ref.slice(4))] ?? null;
    } else if (ref) {
      const relative = toRelativePath(ref);
      v.image = removed.has(relative) ? null : relative;
    } else {
      v.image = null;
    }
  }
}

module.exports = { normaliseVariants, validateVariants, resolveVariantImages };
