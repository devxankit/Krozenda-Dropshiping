const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Vendor = require('../Models/Vendor');
const Coupon = require('../Models/Coupon');
const CjOrder = require('../Models/CjOrder');
const ReturnRequest = require('../Models/ReturnRequest');
const AccountingConfig = require('../Models/AccountingConfig');
const { loadRules, resolveForLine } = require('./commissionResolver');
const { usdToInr } = require('./cj/cjPricing');
const { lineGrossPaise, lineDiscountsPaise } = require('../utils/orderLines');
const { toPaise } = require('../utils/money');
const { buildBuckets, dayKey } = require('../utils/analyticsRange');

// Who earned what, for one window — the admin Revenue screen and the seller's
// own Revenue screen both read this, so the two can never disagree about a
// seller's figures.
//
// Every order line lands in exactly one CHANNEL:
//   cj        — fulfilled by CJ Dropshipping (a DROPSHIP order, or a product
//               with fulfillmentProvider CJ)
//   sellers   — a seller's product (items.vendor, else the product's vendor)
//   own_stock — everything else: the platform's own catalogue
//
// Per line, all in integer PAISE:
//   sales       what the buyer paid for the line — price × qty less its share
//               of the coupon. Shipping is order-level and reported apart.
//   refunds     approved return refunds on that line
//   netSales    sales − refunds
//   commission  (sellers) resolved through the SAME rule → seller rate →
//               platform default hierarchy the ledger posts with, and given
//               back in proportion to any refund, as the ledger does
//   cost        (CJ) what CJ charged, USD → INR at CJ_USD_TO_INR_RATE;
//               (own stock) product cost price × qty, where one is set
//   earnings    Krozenda's share: own-stock net − cost, CJ net − CJ cost,
//               seller commission
//
// Which lines count: placed in the window (order createdAt, IST), order not
// cancelled, line not cancelled. In-progress lines are included and
// reported separately as `inProgressSales`, so "sold" and "delivered" can
// both be read off the same screen.

const CHANNELS = Object.freeze({
  OWN_STOCK: 'own_stock',
  CJ: 'cj',
  SELLERS: 'sellers',
});

const CHANNEL_LABELS = Object.freeze({
  [CHANNELS.OWN_STOCK]: 'Own stock',
  [CHANNELS.CJ]: 'CJ Dropshipping',
  [CHANNELS.SELLERS]: 'Sellers',
});

const CHANNEL_ORDER = [CHANNELS.OWN_STOCK, CHANNELS.CJ, CHANNELS.SELLERS];

function emptyFigures() {
  return {
    orders: 0,
    units: 0,
    sales: 0,
    refunds: 0,
    netSales: 0,
    inProgressSales: 0,
    commission: 0,
    cost: 0,
    earnings: 0,
    sellerEarnings: 0,
    linesWithoutCost: 0,
  };
}

function add(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'number') target[key] = (target[key] || 0) + source[key];
  }
}

function channelOf(order, item, product) {
  if (order.fulfillmentType === 'DROPSHIP' || product?.fulfillmentProvider === 'CJ') return CHANNELS.CJ;
  if (item.vendor || product?.vendor) return CHANNELS.SELLERS;
  return CHANNELS.OWN_STOCK;
}

// Approved refunds per (order, product[, variant]) line.
async function refundsByLine(orderIds) {
  if (!orderIds.length) return new Map();
  const requests = await ReturnRequest.find({
    order: { $in: orderIds },
    status: 'APPROVED',
    requestType: 'REFUND',
  })
    .select('order product variantId refundAmount')
    .lean();
  const map = new Map();
  for (const r of requests) {
    const key = `${r.order}:${r.product}:${r.variantId || ''}`;
    map.set(key, (map.get(key) || 0) + toPaise(r.refundAmount || 0));
  }
  return map;
}

function refundFor(map, order, item) {
  const exact = map.get(`${order._id}:${item.product}:${item.variantId || ''}`);
  if (exact !== undefined) return exact;
  // Requests written before variants existed carry no variantId.
  return item.variantId ? map.get(`${order._id}:${item.product}:`) || 0 : 0;
}

// CJ's charge for each dropship order, in paise. CJ fills totalCost /
// shippingCost once the order is confirmed; before that, the unit costs
// snapshotted at order time are the best figure there is.
async function cjCostByOrder(orderIds) {
  if (!orderIds.length) return new Map();
  const cjOrders = await CjOrder.find({ krozendaOrderId: { $in: orderIds } })
    .select('krozendaOrderId items totalCost shippingCost currency status')
    .lean();
  const map = new Map();
  for (const cj of cjOrders) {
    if (['CANCELLED', 'FULFILLMENT_FAILED'].includes(cj.status)) continue;
    const productCost =
      cj.totalCost > 0 ? cj.totalCost : (cj.items || []).reduce((sum, i) => sum + (i.unitCost || 0) * (i.quantity || 0), 0);
    const raw = productCost + (cj.shippingCost || 0);
    const inr = String(cj.currency || 'USD').toUpperCase() === 'INR' ? raw : usdToInr(raw);
    const key = String(cj.krozendaOrderId);
    map.set(key, (map.get(key) || 0) + toPaise(inr));
  }
  return map;
}

/**
 * @param {object} args
 * @param {Date}   args.start      inclusive
 * @param {Date}   args.end        exclusive
 * @param {object} [args.range]    a resolveRange() result, to bucket a trend
 * @param {string} [args.vendorId] only this seller's lines
 */
async function computeRevenue({ start, end, range = null, vendorId = null }) {
  const match = { createdAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } };
  if (vendorId) match['items.vendor'] = vendorId;

  const orders = await Order.find(match)
    .select('items fulfillmentType status shippingFee discountAmount couponCode createdAt')
    .lean();

  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product))))];
  const couponCodes = [...new Set(orders.map((o) => o.couponCode).filter(Boolean))];
  const orderIds = orders.map((o) => o._id);
  const dropshipIds = orders.filter((o) => o.fulfillmentType === 'DROPSHIP').map((o) => o._id);

  const [products, coupons, refunds, cjCosts, config] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('vendor category costPrice fulfillmentProvider').lean(),
    Coupon.find({ code: { $in: couponCodes } }).select('code vendorId').lean(),
    refundsByLine(orderIds),
    vendorId ? new Map() : cjCostByOrder(dropshipIds),
    AccountingConfig.findOne().lean(),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const sellerFundedCoupon = new Set(coupons.filter((c) => c.vendorId).map((c) => c.code));
  const commissionConfig = config || { defaultCommissionPercent: 10, commissionBase: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT' };

  // Every seller in play, with their negotiated rate, and the commission
  // rules that could apply to any of their lines.
  const sellerIds = new Set();
  for (const order of orders) {
    for (const item of order.items) {
      const product = productById.get(String(item.product));
      const seller = item.vendor || product?.vendor;
      if (seller && channelOf(order, item, product) === CHANNELS.SELLERS) sellerIds.add(String(seller));
    }
  }
  const [vendors, rules] = await Promise.all([
    Vendor.find({ _id: { $in: [...sellerIds] } }).select('name business.businessName vendorType').lean(),
    loadRules({
      vendorIds: [...sellerIds],
      categoryIds: products.map((p) => p.category).filter(Boolean),
      productIds,
    }),
  ]);
  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));

  const totals = emptyFigures();
  const channels = Object.fromEntries(CHANNEL_ORDER.map((c) => [c, emptyFigures()]));
  const sellers = new Map();
  const productRows = new Map();
  let shippingFees = 0;

  const { buckets, indexByDay } = range ? buildBuckets(range) : { buckets: [], indexByDay: new Map() };
  const trend = buckets.map((b) => ({ label: b.label, ...Object.fromEntries(CHANNEL_ORDER.map((c) => [c, 0])), total: 0 }));

  for (const order of orders) {
    const discounts = lineDiscountsPaise(order);
    const bucket = trend[indexByDay.get(dayKey(new Date(order.createdAt)))];
    const channelsInOrder = new Set();
    const sellersInOrder = new Set();
    let orderHasLine = false;

    // CJ's charge is per order; spread it over the order's CJ lines by value.
    const cjLines = order.items.filter(
      (item) => item.status !== 'CANCELLED' && channelOf(order, item, productById.get(String(item.product))) === CHANNELS.CJ
    );
    const cjGross = cjLines.reduce((sum, item) => sum + lineGrossPaise(item), 0);
    const cjCost = cjCosts.get(String(order._id)) || 0;

    order.items.forEach((item, index) => {
      if (item.status === 'CANCELLED') return;
      const product = productById.get(String(item.product));
      const channel = channelOf(order, item, product);
      const seller = channel === CHANNELS.SELLERS ? String(item.vendor || product?.vendor) : null;
      if (vendorId && seller !== String(vendorId)) return;

      const gross = lineGrossPaise(item);
      const sales = Math.max(0, gross - (discounts[index] || 0));
      const refund = Math.min(sales, refundFor(refunds, order, item));
      const net = sales - refund;
      const line = {
        units: item.quantity,
        sales,
        refunds: refund,
        netSales: net,
        inProgressSales: item.status === 'DELIVERED' ? 0 : sales,
      };

      if (channel === CHANNELS.SELLERS) {
        const base =
          commissionConfig.commissionBase === 'LINE_GROSS'
            ? gross
            : commissionConfig.commissionBase === 'LINE_NET' || sellerFundedCoupon.has(order.couponCode)
              ? sales
              : gross;
        const full = resolveForLine(
          {
            basePaise: base,
            vendorId: seller,
            categoryId: product?.category,
            productId: item.product,
            quantity: item.quantity,
          },
          rules,
          commissionConfig
        ).amountPaise;
        // A refund gives the commission back in proportion, as the ledger does.
        line.commission = sales > 0 ? Math.round((full * net) / sales) : 0;
        line.earnings = line.commission;
        line.sellerEarnings = net - line.commission;
      } else if (channel === CHANNELS.CJ) {
        line.cost = cjGross > 0 ? Math.round((cjCost * gross) / cjGross) : 0;
        line.earnings = net - line.cost;
      } else {
        const hasCost = typeof product?.costPrice === 'number' && product.costPrice > 0;
        line.cost = hasCost ? toPaise(product.costPrice) * item.quantity : 0;
        line.linesWithoutCost = hasCost ? 0 : 1;
        line.earnings = net - line.cost;
      }

      add(totals, line);
      add(channels[channel], line);
      channelsInOrder.add(channel);
      orderHasLine = true;
      if (bucket) {
        bucket[channel] += net;
        bucket.total += net;
      }

      if (seller) {
        sellersInOrder.add(seller);
        if (!sellers.has(seller)) sellers.set(seller, emptyFigures());
        add(sellers.get(seller), line);
      }

      const productKey = String(item.product);
      if (!productRows.has(productKey)) productRows.set(productKey, { id: productKey, name: item.name, ...emptyFigures() });
      add(productRows.get(productKey), line);
    });

    if (!orderHasLine) continue;
    totals.orders += 1;
    for (const channel of channelsInOrder) channels[channel].orders += 1;
    for (const seller of sellersInOrder) sellers.get(seller).orders += 1;
    // Shipping belongs to the order, not to one seller — reported only on
    // the platform view.
    if (!vendorId) shippingFees += toPaise(order.shippingFee || 0);
  }

  return {
    totals: { ...totals, shippingFees },
    channels: CHANNEL_ORDER.map((key) => ({ key, label: CHANNEL_LABELS[key], ...channels[key] })),
    sellers: [...sellers.entries()]
      .map(([id, figures]) => {
        const vendor = vendorById.get(id);
        return {
          id,
          name: vendor?.business?.businessName || vendor?.name || 'Unknown seller',
          vendorType: vendor?.vendorType || '',
          ...figures,
        };
      })
      .sort((a, b) => b.netSales - a.netSales),
    products: [...productRows.values()].sort((a, b) => b.netSales - a.netSales).slice(0, 10),
    trend,
  };
}

module.exports = { computeRevenue, CHANNELS, CHANNEL_LABELS, CHANNEL_ORDER };
