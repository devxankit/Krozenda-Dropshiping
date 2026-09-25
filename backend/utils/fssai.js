const VendorDocument = require('../Models/VendorDocument');

// Food categories need the proposing seller to hold an FSSAI licence that
// admin has approved. The licence is an ordinary VendorDocument of this type,
// uploaded either during sign-up (when the seller answers "Yes, I sell food")
// or later from Store Profile.
const FSSAI_DOC_TYPE = 'FSSAI_LICENSE';

// Seller-proposed categories carry an explicit isFood flag (the checkbox in
// the Add Category drawer), but a seller who answered "No" at sign-up has
// every reason to leave it unticked. The name check catches those, so
// "Organic Snacks" cannot slip past review just because the box was blank.
const FOOD_KEYWORDS = [
  'food', 'grocery', 'groceries', 'snack', 'beverage', 'drink', 'juice', 'tea', 'coffee',
  'spice', 'masala', 'sweet', 'mithai', 'bakery', 'cake', 'biscuit', 'cookie', 'chocolate',
  'confectionery', 'dairy', 'milk', 'ghee', 'paneer', 'cheese', 'butter', 'honey', 'pickle',
  'achar', 'namkeen', 'dry fruit', 'dryfruit', 'nut', 'rice', 'atta', 'flour', 'dal', 'pulse',
  'cooking oil', 'edible', 'fruit', 'vegetable', 'meat', 'chicken', 'seafood', 'egg',
  'nutrition', 'supplement', 'protein', 'noodle', 'pasta', 'sauce', 'jam', 'cereal',
];

function looksLikeFood(name) {
  const text = String(name || '').toLowerCase();
  // Whole words (plus a plural s/es) so "Green Tea" and "Snacks" match but
  // "Teak Furniture" and "Toilet Cleaner" do not.
  return FOOD_KEYWORDS.some((word) => new RegExp(`(^|[^a-z])${word}(s|es)?($|[^a-z])`).test(text));
}

// APPROVED if any licence was approved; otherwise the state of the most
// recent upload (PENDING / REJECTED); MISSING if none was ever uploaded.
async function getFssaiStatus(vendorId) {
  const docs = await VendorDocument.find({ vendorId, documentType: FSSAI_DOC_TYPE })
    .sort({ createdAt: -1 })
    .lean();
  return summarize(docs);
}

// Same answer for many vendors in one query — the approval queue needs it
// for every food category on the page.
async function getFssaiStatusMap(vendorIds) {
  const docs = await VendorDocument.find({ vendorId: { $in: vendorIds }, documentType: FSSAI_DOC_TYPE })
    .sort({ createdAt: -1 })
    .lean();
  const byVendor = new Map();
  for (const doc of docs) {
    const key = doc.vendorId.toString();
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key).push(doc);
  }
  const result = new Map();
  for (const id of vendorIds) {
    result.set(id.toString(), summarize(byVendor.get(id.toString()) || []).status);
  }
  return result;
}

function summarize(docsNewestFirst) {
  const approved = docsNewestFirst.find((d) => d.status === 'APPROVED');
  if (approved) return { status: 'APPROVED', document: approved };
  if (docsNewestFirst.length) return { status: docsNewestFirst[0].status, document: docsNewestFirst[0] };
  return { status: 'MISSING', document: null };
}

// What admin (and the seller) is told when a food category can't be approved.
function fssaiBlockMessage(status) {
  if (status === 'PENDING') return 'Seller has uploaded an FSSAI licence but it is still awaiting review. Approve the licence first (KYC → seller).';
  if (status === 'REJECTED') return 'Seller\'s FSSAI licence was rejected. They must upload a valid licence before this food category can be approved.';
  return 'Seller has not uploaded an FSSAI licence. A food category can only be approved once their licence is uploaded and approved.';
}

module.exports = { FSSAI_DOC_TYPE, looksLikeFood, getFssaiStatus, getFssaiStatusMap, fssaiBlockMessage };
