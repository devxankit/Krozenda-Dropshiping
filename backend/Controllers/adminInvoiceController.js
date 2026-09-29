const mongoose = require('mongoose');
const Order = require('../Models/Order');
const PlatformSettings = require('../Models/PlatformSettings');
const { buildInvoices, composeInvoices, supplierMapsFor } = require('../services/invoiceService');

// Admin view of the buyer tax invoices. Invoices are not stored: each is
// derived from its order by services/invoiceService — the same code the
// buyer's GET /user/orders/:id/invoice runs — so the admin and the buyer can
// never see different figures. One order carries one invoice per supplier
// (Krozenda for own-stock/CJ lines and charges, each seller for theirs).
//
// An invoice id is `<orderId>-<n>`, n being the invoice's 1-based position in
// the order's invoice set. All money is integer PAISE.

// An order is invoiced once it is a real supply: not cancelled, and paid for
// unless it is cash on delivery. A Razorpay order still awaiting capture, or
// a failed payment, has no invoice yet.
const INVOICED = {
  status: { $ne: 'CANCELLED' },
  paymentStatus: { $ne: 'FAILED' },
  $nor: [{ paymentMethod: { $in: ['RAZORPAY', 'WALLET'] }, paymentStatus: 'PENDING' }],
};

const TABS = {
  all: () => true,
  krozenda: (row) => row.supplierKind === 'PLATFORM',
  vendor: (row) => row.supplierKind !== 'PLATFORM',
  inter_state: (row) => row.isInterState,
};

const DATE = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };
const displayDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', DATE) : '');

// Suppliers carry `addressLine`; an order's shipping address has line1/line2.
const joinAddress = (a = {}) =>
  [a.addressLine, a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');

function paymentLabel(order) {
  if (order.paymentStatus === 'REFUNDED') return 'Refunded';
  if (order.paymentStatus === 'PAID') return 'Paid';
  if (order.paymentMethod === 'COD') return 'Cash on delivery (not yet collected)';
  return 'Payment pending';
}

// One list row per invoice in the set.
function rowsFor(set, order) {
  return set.invoices
    .filter((inv) => inv.items.length > 0 || inv.totals.total > 0)
    .map((inv, index) => ({
      id: `${set.orderId}-${index + 1}`,
      number: inv.invoiceNumber,
      orderId: set.orderId,
      subOrderId: set.orderNumber,
      sellerOfRecord: inv.supplier.name,
      supplierKind: inv.supplier.kind,
      buyer: set.buyer.companyName || set.buyer.name || order.user?.name || '',
      issuedAt: displayDate(set.invoiceDate),
      taxableValue: inv.totals.taxable,
      gst: inv.totals.tax,
      total: inv.totals.total,
      placeOfSupply: set.placeOfSupply.stateName || '',
      isInterState: inv.taxType === 'INTER',
      documentType: inv.documentType,
      invoice: inv,
    }));
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /admin/invoices?tab=&search=&page=&rowsPerPage=
//
// Tabs depend on who the supplier is and on the supplier's state, which only
// exist once the invoice set is composed, so the list is composed in memory
// over the invoiced orders (settings and sellers are fetched once for all of
// them, not per order).
async function listInvoices(req, res) {
  const { tab = 'all', search, page = 1, rowsPerPage = 25 } = req.query;

  const [orders, settings] = await Promise.all([
    Order.find(INVOICED).sort({ createdAt: -1, _id: -1 }).populate('user', 'name').lean(),
    PlatformSettings.getSettings(),
  ]);
  const supplierMaps = await supplierMapsFor(orders, settings);

  let rows = [];
  for (const order of orders) {
    const set = composeInvoices(order, supplierMaps.get(String(order._id)), settings);
    rows.push(...rowsFor(set, order));
  }

  const term = String(search || '').trim().slice(0, 100);
  if (term) {
    const re = new RegExp(escapeRegex(term.replace(/^#/, '')), 'i');
    rows = rows.filter((row) =>
      [row.number, row.subOrderId, row.orderId, row.buyer, row.sellerOfRecord].some((v) => re.test(v))
    );
  }

  const tabCounts = Object.fromEntries(
    Object.entries(TABS).map(([key, match]) => [key, rows.filter(match).length])
  );
  const inTab = rows.filter(TABS[tab] || TABS.all);

  const perPage = Math.min(100, Math.max(1, Number(rowsPerPage) || 25));
  const totalPages = Math.max(1, Math.ceil(inTab.length / perPage));
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));

  res.json({
    success: true,
    data: {
      items: inTab
        .slice((currentPage - 1) * perPage, currentPage * perPage)
        .map(({ invoice, supplierKind, ...row }) => row),
      page: currentPage,
      rowsPerPage: perPage,
      totalItems: inTab.length,
      totalPages,
      tabCounts,
    },
  });
}

// GET /admin/invoices/:id — one invoice, in full. Opening it freezes the
// order's supplier details exactly as the buyer opening their invoice does.
async function getInvoice(req, res) {
  const match = /^([a-f0-9]{24})-(\d+)$/i.exec(String(req.params.id || ''));
  if (!match || !mongoose.isValidObjectId(match[1])) {
    return res.status(400).json({ success: false, message: 'Invalid invoice id' });
  }

  const order = await Order.findOne({ _id: match[1], ...INVOICED }).populate('user', 'name').lean();
  if (!order) return res.status(404).json({ success: false, message: 'Invoice not found' });

  const set = await buildInvoices(order);
  const row = rowsFor(set, order)[Number(match[2]) - 1];
  if (!row) return res.status(404).json({ success: false, message: 'Invoice not found' });

  const { invoice, supplierKind, ...header } = row;
  const supplier = invoice.supplier;

  res.json({
    success: true,
    data: {
      ...header,
      taxType: invoice.taxType,
      paymentStatus: paymentLabel(order),
      shipping: invoice.shipping || 0,
      platformFee: invoice.platformFee || 0,
      seller: {
        name: supplier.legalName || supplier.name,
        gstin: supplier.gstin || '',
        address: joinAddress(supplier.address),
        state: supplier.stateName ? `${supplier.stateName} (${supplier.stateCode})` : '',
      },
      buyerDetail: {
        name: set.buyer.companyName || set.buyer.name || order.user?.name || '',
        gstin: set.buyer.gstin || null,
        address: joinAddress(set.buyer.address),
        isB2B: set.buyer.isB2B,
      },
      lines: invoice.items.map((item) => ({
        name: item.variant ? `${item.name} (${item.variant})` : item.name,
        hsn: item.hsnCode || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxableValue: item.taxable,
        gstRate: item.gstRate,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        total: item.total,
      })),
    },
  });
}

module.exports = { listInvoices, getInvoice };
