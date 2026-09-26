const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const PlatformSettings = require('../Models/PlatformSettings');
const { lineGrossPaise, lineDiscountsPaise } = require('../utils/orderLines');
const { toPaise } = require('../utils/money');
const { stateCodeFromGstin, stateCodeFromName, stateName, isValidGstin } = require('../utils/gstStates');

// The buyer's tax invoice(s) for one order.
//
// Under GST the invoice is issued by whoever SUPPLIES the goods, so one order
// can carry several invoices — one per supplier:
//
//   Krozenda (platform GSTIN)  own-stock lines, CJ Dropshipping lines, and the
//                              order's shipping charge
//   each seller (their GSTIN)  that seller's lines
//
// CGST + SGST vs IGST is decided per invoice: the SUPPLIER's state (from its
// GSTIN, else its address) against the place of supply (the buyer's shipping
// state). A seller with no valid GSTIN cannot charge GST, so their document
// is a Bill of Supply with no tax lines.
//
// Supplier details are frozen onto the order the first time its invoice is
// produced (Order.invoiceSuppliers): a seller changing their GSTIN or address
// later must not rewrite an invoice already issued. Line amounts need no
// freezing — the order already snapshots price, discount and GST rate.
//
// All money is integer PAISE.

const PLATFORM_KEY = 'PLATFORM';

function supplierKeyFor(order, item) {
  if (order.fulfillmentType === 'DROPSHIP' || !item.vendor) return PLATFORM_KEY;
  return `VENDOR:${item.vendor}`;
}

function platformSupplier(settings) {
  const address = settings.registeredAddress || {};
  const gstin = String(settings.gstin || '').toUpperCase();
  return {
    key: PLATFORM_KEY,
    kind: 'PLATFORM',
    name: settings.name || 'Krozenda',
    legalName: settings.legalEntity || settings.name || 'Krozenda',
    gstin: isValidGstin(gstin) ? gstin : '',
    address: {
      addressLine: address.addressLine || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
    },
    stateCode: stateCodeFromGstin(gstin) || stateCodeFromName(address.state),
  };
}

function vendorSupplier(vendor) {
  const business = vendor.business || {};
  const address = vendor.address || {};
  const gstin = String(business.gstin || '').toUpperCase();
  return {
    key: `VENDOR:${vendor._id}`,
    kind: 'SELLER',
    vendor: String(vendor._id),
    name: business.tradeName || business.businessName || vendor.name,
    legalName: business.businessName || vendor.name,
    gstin: isValidGstin(gstin) ? gstin : '',
    address: {
      addressLine: address.addressLine || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
    },
    stateCode: stateCodeFromGstin(gstin) || stateCodeFromName(address.state),
  };
}

// The suppliers on this order, frozen on first use.
async function suppliersFor(order) {
  if (Array.isArray(order.invoiceSuppliers) && order.invoiceSuppliers.length) {
    return new Map(order.invoiceSuppliers.map((s) => [s.key, s]));
  }

  const keys = new Set(order.items.map((item) => supplierKeyFor(order, item)));
  if (toPaise(order.shippingFee || 0) > 0) keys.add(PLATFORM_KEY);
  const vendorIds = [...keys].filter((k) => k.startsWith('VENDOR:')).map((k) => k.slice('VENDOR:'.length));

  const [settings, vendors] = await Promise.all([
    keys.has(PLATFORM_KEY) ? PlatformSettings.getSettings() : null,
    Vendor.find({ _id: { $in: vendorIds } }).select('name business address').lean(),
  ]);

  const suppliers = [];
  if (settings) suppliers.push(platformSupplier(settings));
  for (const vendor of vendors) suppliers.push(vendorSupplier(vendor));

  // Only the first writer freezes them; a concurrent first view reads the
  // same values anyway.
  await Order.updateOne(
    { _id: order._id, invoiceSuppliers: { $exists: false } },
    { $set: { invoiceSuppliers: suppliers, invoiceGeneratedAt: new Date() } }
  );
  const fresh = await Order.findById(order._id).select('invoiceSuppliers').lean();
  const frozen = fresh?.invoiceSuppliers?.length ? fresh.invoiceSuppliers : suppliers;
  return new Map(frozen.map((s) => [s.key, s]));
}

// Tax inside a GST-inclusive amount.
function splitInclusive(amountPaise, ratePercent) {
  if (!ratePercent) return { taxable: amountPaise, tax: 0 };
  const taxable = Math.round((amountPaise * 100) / (100 + ratePercent));
  return { taxable, tax: amountPaise - taxable };
}

function taxParts(tax, taxType) {
  if (taxType === 'INTER') return { cgst: 0, sgst: 0, igst: tax };
  if (taxType === 'INTRA') {
    const cgst = Math.floor(tax / 2);
    return { cgst, sgst: tax - cgst, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: 0 };
}

function emptyTotals() {
  return { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, shipping: 0, total: 0 };
}

/**
 * @returns {Promise<object>} the invoice set for one order
 */
async function buildInvoices(order) {
  const suppliers = await suppliersFor(order);
  const settings = await PlatformSettings.getSettings();
  const fallbackRate = Number(settings.defaultGstRate ?? 18);

  const address = order.shippingAddress || {};
  const placeCode = stateCodeFromName(address.state) || stateCodeFromGstin(order.b2b?.gstin);
  const discounts = lineDiscountsPaise(order);

  const bySupplier = new Map();
  const invoiceFor = (key) => {
    if (!bySupplier.has(key)) {
      const supplier = suppliers.get(key);
      const registered = Boolean(supplier?.gstin);
      // Unknown place of supply is treated as intra-state: the address form
      // always asks for a state, so this is only very old data.
      const taxType = !registered ? 'NONE' : !placeCode || placeCode === supplier.stateCode ? 'INTRA' : 'INTER';
      bySupplier.set(key, { supplier, taxType, items: [], shipping: null, totals: emptyTotals() });
    }
    return bySupplier.get(key);
  };

  order.items.forEach((item, index) => {
    if (item.status === 'CANCELLED') return;
    const invoice = invoiceFor(supplierKeyFor(order, item));

    const gross = lineGrossPaise(item);
    const discount = discounts[index] || 0;
    const net = Math.max(0, gross - discount);
    // The order snapshots the GST rate; orders from before the snapshot
    // existed fall back to the platform default.
    const snapshotted = Number(item.taxableValue) > 0 || Number(item.gstRate) > 0;
    const rate = invoice.taxType === 'NONE' ? 0 : snapshotted ? Number(item.gstRate) || 0 : fallbackRate;
    const { taxable, tax } = splitInclusive(net, rate);
    const parts = taxParts(tax, invoice.taxType);

    invoice.items.push({
      name: item.name,
      variant: item.variant || '',
      hsnCode: item.hsnCode || '',
      quantity: item.quantity,
      unitPrice: toPaise(item.price),
      gross,
      discount,
      taxable,
      gstRate: rate,
      ...parts,
      tax,
      total: net,
    });
    const t = invoice.totals;
    t.gross += gross;
    t.discount += discount;
    t.taxable += taxable;
    t.cgst += parts.cgst;
    t.sgst += parts.sgst;
    t.igst += parts.igst;
    t.tax += tax;
    t.total += net;
  });

  // Delivery is arranged and charged by the platform, so it sits on the
  // platform's invoice, as charged (not split into tax).
  const shipping = toPaise(order.shippingFee || 0);
  if (shipping > 0) {
    const invoice = invoiceFor(PLATFORM_KEY);
    invoice.shipping = shipping;
    invoice.totals.shipping += shipping;
    invoice.totals.total += shipping;
  }

  // The buyer's platform fee is the platform's charge, like delivery.
  const platformFee = toPaise(order.platformFee || 0);
  if (platformFee > 0) {
    const invoice = invoiceFor(PLATFORM_KEY);
    invoice.platformFee = platformFee;
    invoice.totals.platformFee = (invoice.totals.platformFee || 0) + platformFee;
    invoice.totals.total += platformFee;
  }

  // Platform first, then sellers in the order their lines appear.
  const ordered = [...bySupplier.entries()]
    .sort(([a], [b]) => (a === PLATFORM_KEY ? -1 : b === PLATFORM_KEY ? 1 : 0))
    .map(([, invoice]) => invoice);

  const base = `INV-${String(order._id).slice(-10).toUpperCase()}`;
  const invoices = ordered.map((invoice, index) => ({
    invoiceNumber: ordered.length === 1 ? base : `${base}-${index + 1}`,
    documentType: invoice.taxType === 'NONE' ? 'BILL_OF_SUPPLY' : 'TAX_INVOICE',
    supplier: {
      kind: invoice.supplier?.kind || 'SELLER',
      name: invoice.supplier?.name || 'Seller',
      legalName: invoice.supplier?.legalName || '',
      gstin: invoice.supplier?.gstin || '',
      address: invoice.supplier?.address || {},
      stateCode: invoice.supplier?.stateCode || '',
      stateName: stateName(invoice.supplier?.stateCode),
    },
    taxType: invoice.taxType,
    items: invoice.items,
    shipping: invoice.shipping,
    platformFee: invoice.platformFee || 0,
    totals: invoice.totals,
  }));

  return {
    orderId: String(order._id),
    orderNumber: `#${String(order._id).slice(-8).toUpperCase()}`,
    invoiceDate: order.createdAt,
    paymentMethod: order.paymentMethod,
    placeOfSupply: { stateCode: placeCode || '', stateName: stateName(placeCode) || address.state || '' },
    buyer: {
      name: address.fullName || '',
      companyName: order.b2b?.isB2B ? order.b2b.companyName || '' : '',
      gstin: order.b2b?.gstin || '',
      isB2B: Boolean(order.b2b?.isB2B),
      address,
    },
    invoices,
    grandTotal: invoices.reduce((sum, inv) => sum + inv.totals.total, 0),
  };
}

module.exports = { buildInvoices, splitInclusive, PLATFORM_KEY };
