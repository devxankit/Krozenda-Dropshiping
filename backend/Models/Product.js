const mongoose = require('mongoose');
const { generateBarcode } = require('../utils/barcode');


// A buyable variation of a product: one size, one colour, one pack size. Each
// carries its OWN price and stock, which is the whole reason this is a
// subdocument and not a string — the `variant` field on cart and order lines
// was free text, so "Red / L" cost whatever the parent product cost and drew
// down one shared stock number.
//
// Variants are optional. A product with none behaves exactly as before, which
// is what keeps every existing product and every existing order valid.
const productVariantSchema = new mongoose.Schema(
  {
    // Human label, e.g. "Red / L". Shown on the cart line and snapshotted onto
    // the order, so it must stay readable on its own.
    name: { type: String, required: true, trim: true },
    // Structured form of the same thing: { colour: 'Red', size: 'L' }. Drives
    // the storefront's option pickers; `name` stays the thing people read.
    attributes: { type: Map, of: String, default: () => new Map() },
    sku: { type: String, trim: true, default: '' },
    barcode: { type: String, trim: true, default: null },
    // Null means "same as the parent product" for both. A variant that only
    // differs by stock should not have to restate the price.
    price: { type: Number, default: null, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    // Admin-only, like the parent's costPrice — never sent to the storefront.
    costPrice: { type: Number, default: null, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    // Shipping weight in KILOGRAMS. Null means "same as the parent" — an XL
    // jacket and an S jacket ship at different weights, a Red and a Blue do not.
    weight: { type: Number, default: null, min: 0 },
    // One of the parent's `images`, not a separate upload: the gallery is the
    // single place photos live, and a variant only points at its own.
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

// Quantity-break pricing: buy `minQty` or more and the unit price is `price`.
// This is what makes the platform B2B-capable — a dealer buying 100 units pays
// a different unit price from a retail buyer buying one, without needing a
// separate catalog.
//
// Tiers are resolved by utils/pricing.resolveUnitPrice, which picks the
// highest minQty the line qualifies for. Nothing else should interpret them.
const priceTierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 2 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // No `default: null` here on purpose — the sparse unique index below
    // only skips documents where the field is genuinely absent, not ones
    // explicitly set to null. A default of null meant every second product
    // created without a SKU threw an uncaught E11000 duplicate-key error.
    sku: { type: String, trim: true },
    // A real, scannable EAN-13. Assigned automatically the moment a product
    // is created (see the pre-save hook below) — nobody types or uploads
    // one, so there is nothing to get wrong or leave blank. Once set it is
    // never reassigned; the label that gets printed and stuck on a box has
    // to keep meaning the same product for the product's whole life.
    barcode: { type: String, trim: true, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
    // null = platform-owned catalog item (current default for everything
    // created via the admin panel). Set once a product is attributed to a
    // marketplace seller, so order items and support tickets can be routed
    // to the right vendor instead of always falling back to Admin.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    // Denormalized off ProductFulfillmentMapping (the real source of truth —
    // see that model's own comment) purely so the public catalog can filter
    // "dropship only / normal only / all" with a plain indexed match instead
    // of a $lookup on every browse request. Set once at onboarding time and
    // never read by checkout/fulfilment logic, which still goes through
    // ProductFulfillmentMapping as before.
    fulfillmentProvider: { type: String, enum: ['CJ', null], default: null, index: true },
    // Vendor-created products enter the marketplace catalog PENDING until an
    // admin approves them — admin-created products (vendor: null) skip this
    // by defaulting straight to APPROVED, matching pre-marketplace behavior.
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    rejectionReason: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    costPrice: { type: Number, default: null, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: null, min: 0 },
    // Shipping weight in KILOGRAMS. Nullable, and stays nullable: Decision B
    // makes dimensions optional and falls back to a vendor default, then a
    // platform default, then the seller's own "Verify Package" measurement.
    weight: { type: Number, default: null, min: 0 },
    // Shipping dimensions in CENTIMETRES. All three or none — a partial set
    // cannot produce a volumetric weight, so utils/packaging treats it as
    // absent (see hasDimensions).
    dimensions: {
      type: new mongoose.Schema(
        {
          lengthCm: { type: Number, default: null, min: 0 },
          breadthCm: { type: Number, default: null, min: 0 },
          heightCm: { type: Number, default: null, min: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
    images: { type: [String], default: [] },
    shortDescription: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },

    // --- tax ---------------------------------------------------------------
    // HSN/SAC code and the GST rate that applies to it. Required on a tax
    // invoice in India; null means "not classified yet", which is honest for
    // the catalog as it stands rather than a fabricated default.
    hsnCode: { type: String, trim: true, default: '', uppercase: true },
    // Percent. The GST slabs are 0/5/12/18/28 — enforced rather than free,
    // because an invented rate produces an invoice that is wrong by law.
    gstRate: { type: Number, default: null, min: 0, max: 28 },

    // --- B2B ---------------------------------------------------------------
    // Minimum order quantity. 1 means no minimum, which is every existing
    // product, so this is backwards-compatible by construction.
    moq: { type: Number, default: 1, min: 1 },
    // Quantity breaks, see priceTierSchema. Kept sorted ascending by minQty on
    // save so the resolver can read them in order.
    priceTiers: { type: [priceTierSchema], default: [] },

    // --- variants ----------------------------------------------------------
    // Empty on a simple product. See productVariantSchema.
    variants: { type: [productVariantSchema], default: [] },
    status: { type: String, enum: ['Draft', 'Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true },
    isFlashsale: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    // Whether a buyer may raise a return/replacement on this product. Set by
    // whoever owns the product (admin or seller) on the product form. Defaults
    // to true so every product created before this switch keeps the return
    // policy it was sold under. Snapshotted onto the order line at checkout
    // (Order.items.returnable) — flipping it later never changes the policy
    // for units already bought.
    isReturnable: { type: Boolean, default: true },
    // 0 means "no reviews yet" — the storefront hides the rating badge
    // rather than showing a fabricated score for a brand new product.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ sku: 1 }, { unique: true, sparse: true });
// Sparse, matching the sku index above: it only has to be unique among
// products that HAVE one, and a product created before this field existed
// (or created inside a single transaction that hasn't committed yet) simply
// has none rather than colliding with every other productless document on a
// shared `barcode: null`.
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });

// Runs once, on creation only — see the field comment above for why a
// barcode is never reassigned. Generating it here rather than in every
// controller that can create a product (admin's and the vendor panel's) means
// a third creation path added later gets one for free instead of silently
// shipping products with no barcode.
// Tiers are stored sorted so resolveUnitPrice can scan them in one pass and
// so an admin reading the document sees them in the order they apply.
productSchema.pre('save', function sortPriceTiers() {
  if (this.isModified('priceTiers') && Array.isArray(this.priceTiers)) {
    this.priceTiers.sort((a, b) => a.minQty - b.minQty);
  }
});

productSchema.pre('save', async function assignBarcode() {
  if (!this.isNew || this.barcode) return;
  this.barcode = await generateBarcode();
});

// Index set derived from what listPublicProducts actually issues, not from
// "one index per field" — every storefront query starts with the same
// { isActive, approvalStatus } pair, so that pair leads each compound index
// and the remaining keys cover the filter and the sort together. A sort the
// index can serve is the difference between a scan-and-sort and a range read.
//
// Deliberately NOT indexed: isFlashsale/isTrending on their own (both are
// boolean and hugely non-selective; they only ever appear alongside the
// isActive+approvalStatus prefix, which the compound indexes below cover).
productSchema.index({ isActive: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, category: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, brand: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, isFlashsale: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, isTrending: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, rating: -1, reviewsCount: -1 });

// Search. A text index is what keeps `?search=` off a collection-wide regex
// scan as the catalog grows; the regex path stays as the fallback for partial
// and mid-word matches, which $text cannot do.
productSchema.index({ name: 'text', sku: 'text' }, { weights: { name: 10, sku: 4 }, name: 'product_text' });
// Plain prefix index on name, still used by the regex path and by
// admin-side name lookups.
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
