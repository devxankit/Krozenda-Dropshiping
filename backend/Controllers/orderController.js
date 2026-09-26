const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const Coupon = require('../Models/Coupon');
const WalletTransaction = require('../Models/WalletTransaction');
const { evaluateCoupon, filterEligibleItems, redeemCoupon } = require('./couponController');
const { createNotification } = require('./notificationController');
const vendorAlerts = require('../services/vendorAlertService');
const { alertAdmins, highValueThreshold } = require('../services/adminAlertService');
const CheckoutAttempt = require('../Models/CheckoutAttempt');
const { buildInvoices } = require('../services/invoiceService');
const Shipment = require('../Models/Shipment');
const trackingService = require('../services/shipping/trackingService');
const { BUYER_FACING_ORDER_STATUS } = require('../Config/shipping');
const PaymentSettings = require('../Models/PaymentSettings');
const checkoutQuoteService = require('../services/shipping/checkoutQuoteService');
const { getImageUrl } = require('../utils/imageHelper');
const PlatformSettings = require('../Models/PlatformSettings');
const {
  checkMoq,
  effectiveGstRate,
  findVariant,
  grossUnitPaise,
  requiresVariant,
  resolveLineTax,
  resolveStock,
  resolveUnitPrice,
} = require('../utils/pricing');
const accounting = require('../services/accountingPosting');
const { readPagination, buildPagination } = require('../utils/pagination');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const dropshipOrderService = require('../services/dropshipOrderService');
const { refundCancelledOrderToWallet } = require('../services/orderCancellationService');
const { findDropshipProductIds, isDropshipOrder } = require('../utils/dropship');
const { isOwnStockProduct, isOwnStockVisibleToCustomers } = require('../utils/ownStock');
const { toPaise, allocateProportional } = require('../utils/money');
const { canRequestReturn } = require('../utils/returnWindow');

// Accounting is posted alongside the order, never in front of it. A ledger
// write must never be able to fail a customer's checkout or a cancellation —
// the money has already moved by the time these run — so every call is
// wrapped and only logged on failure. Nothing is lost when one does fail:
// every posting path is idempotent and the Accounting screens re-run the
// reconciler on read, so a missed row is picked up on the next look
// (see services/accountingPosting.reconcileLedger).
async function postAccounting(label, work) {
  try {
    await work();
  } catch (err) {
    console.error(`Accounting posting failed (${label}), will be reconciled on next read:`, err.message);
  }
}

// Client-supplied, so it is length-capped and character-restricted before it
// ever reaches an index — an unbounded string here would let a caller write
// arbitrarily large keys into every order document.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

function normaliseIdempotencyKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return IDEMPOTENCY_KEY_RE.test(trimmed) ? trimmed : null;
}

// The only shipping prices DeliveryOptionsScreen ever offers — anything else
// arriving in the request body is client tampering, not a legitimate choice.
// The old fixed ladder [0, 99, 199] is gone: shipping is quoted from the
// carrier per cart, per address and per payment method. See
// services/shipping/checkoutQuoteService.

function serializeOrder(o) {
  return {
    id: o._id.toString(),
    items: o.items.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      variant: item.variant || '',
      variantId: item.variantId ? item.variantId.toString() : null,
      discountAmount: item.discountAmount ?? null,
      vendorId: item.vendor ? item.vendor.toString() : null,
      hsnCode: item.hsnCode || '',
      gstRate: item.gstRate || 0,
      taxableValue: item.taxableValue || 0,
      taxAmount: item.taxAmount || 0,
    })),
    shippingAddress: o.shippingAddress,
    subtotal: o.subtotal,
    discountAmount: o.discountAmount,
    couponCode: o.couponCode,
    shippingFee: o.shippingFee,
    platformFee: o.platformFee || 0,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    // A dropship order can be neither cancelled nor returned by the buyer.
    fulfillmentType: o.fulfillmentType || 'STANDARD',
    isDropship: o.fulfillmentType === 'DROPSHIP',
    // Drives the buyer's Return / Replace button.
    canReturn: canRequestReturn(o),
    checkoutGroupId: o.checkoutGroupId || null,
    deliveredAt: o.deliveredAt,
    statusHistory: (o.statusHistory || []).map((entry) => ({ status: entry.status, at: entry.at })),
    b2b: o.b2b
      ? {
          isB2B: Boolean(o.b2b.isB2B),
          companyName: o.b2b.companyName || '',
          gstin: o.b2b.gstin || '',
        }
      : null,
    createdAt: o.createdAt,
  };
}

// checkout errors carry a machine-readable `code` (and sometimes per-item
// details) so the cart/checkout UI can highlight the offending line rather
// than showing one generic toast.
function serializeCheckoutError(error) {
  return {
    success: false,
    ...(error.code ? { code: error.code } : {}),
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };
}

// Shared by createRazorpayOrder (a price "quote" before payment) and
// createOrder (the real purchase) so the two can never disagree about what
// the cart actually costs — the only source of truth is the live DB state,
// never anything the client sends beyond which address/coupon/shipping
// option it picked.
// `paymentMethod` is part of the price now: a courier charges more to collect
// cash, so COD and prepaid are genuinely different quotes.
//
// Note what is NOT a parameter any more — `shippingFee`. It used to come from
// the client and be accepted if it appeared in [0, 99, 199], which meant any
// buyer could choose 0. The fee is now quoted from the carrier here, and
// whatever the client thought it was is ignored.
async function computeCheckoutTotals(user, { addressId, couponCode, paymentMethod }) {
  if (!mongoose.isValidObjectId(addressId)) {
    return { error: { status: 400, message: 'Select a valid delivery address' } };
  }

  const address = await Address.findOne({ _id: addressId, user: user._id });
  if (!address) {
    return { error: { status: 404, message: 'Delivery address not found' } };
  }

  const cart = await Cart.findOne({ user: user._id }).populate('items.product');
  const allEntries = cart?.items || [];
  if (allEntries.length === 0) {
    return { error: { status: 400, message: 'Your cart is empty' } };
  }

  // Entries whose product was hard-deleted OR deactivated since being added.
  // These used to be filtered out silently, which meant a buyer who put three
  // items in their cart could be charged for two without ever being told —
  // the order just came out smaller than the summary they had agreed to.
  // Now checkout stops and names them so the buyer decides.
  // Admin's own-stock products also count as unavailable while the admin
  // has the "Own stock" switch off.
  const hideOwnStock = !(await isOwnStockVisibleToCustomers());
  const unavailable = allEntries.filter(
    (entry) => !entry.product || !entry.product.isActive || (hideOwnStock && isOwnStockProduct(entry.product))
  );
  if (unavailable.length > 0) {
    const names = unavailable.map((entry) => entry.product?.name).filter(Boolean);
    return {
      error: {
        status: 409,
        code: 'CART_ITEM_UNAVAILABLE',
        message: names.length
          ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available. Please remove ${names.length === 1 ? 'it' : 'them'} from your cart to continue.`
          : 'Some items in your cart are no longer available. Please review your cart to continue.',
        details: { productIds: unavailable.map((entry) => entry.product?._id?.toString()).filter(Boolean) },
      },
    };
  }

  const cartEntries = allEntries;

  // Same reasoning for stock: reserveStock would reject the whole order at the
  // very end anyway, so catching it here gives the buyer a specific message
  // ("Only 2 left") before a payment is taken rather than after.
  // A variant that was removed after it went into the cart. Named explicitly
  // rather than folded into "out of stock", because the buyer has to pick a
  // different option, not wait for a restock.
  const staleVariant = cartEntries.filter(
    (entry) => entry.variantId && !findVariant(entry.product, entry.variantId)
  );
  if (staleVariant.length > 0) {
    const names = staleVariant.map((entry) => `${entry.product.name} (${entry.variant || 'selected option'})`);
    return {
      error: {
        status: 409,
        code: 'CART_ITEM_UNAVAILABLE',
        message: `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available in that option. Please choose another to continue.`,
        details: { productIds: staleVariant.map((entry) => entry.product._id.toString()) },
      },
    };
  }

  // A product that has since GAINED variants, so the line in the cart no
  // longer identifies a buyable thing.
  const needsChoice = cartEntries.filter((entry) => !entry.variantId && requiresVariant(entry.product));
  if (needsChoice.length > 0) {
    return {
      error: {
        status: 409,
        code: 'CART_ITEM_NEEDS_OPTION',
        message: `${needsChoice.map((e) => e.product.name).join(', ')} now ${needsChoice.length === 1 ? 'needs' : 'need'} an option chosen. Please update your cart to continue.`,
        details: { productIds: needsChoice.map((entry) => entry.product._id.toString()) },
      },
    };
  }

  // Minimum order quantity, enforced at the point money is about to move. The
  // cart reports it (see mergeCart) but never blocks on it; checkout does.
  const belowMoq = cartEntries
    .map((entry) => ({ entry, message: checkMoq(entry.product, entry.quantity) }))
    .filter((r) => r.message);
  if (belowMoq.length > 0) {
    return {
      error: {
        status: 409,
        code: 'BELOW_MOQ',
        message: `"${belowMoq[0].entry.product.name}" has a minimum order quantity of ${belowMoq[0].entry.product.moq}. Please increase the quantity to continue.`,
        details: {
          items: belowMoq.map(({ entry }) => ({
            productId: entry.product._id.toString(),
            name: entry.product.name,
            requested: entry.quantity,
            moq: entry.product.moq,
          })),
        },
      },
    };
  }

  // Stock, resolved per variant - see utils/pricing.resolveStock.
  const short = cartEntries.filter((entry) => resolveStock(entry.product, entry.variantId) < entry.quantity);
  if (short.length > 0) {
    const first = short[0];
    const available = resolveStock(first.product, first.variantId);
    const label = first.variant ? `${first.product.name} (${first.variant})` : first.product.name;
    return {
      error: {
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message:
          available > 0
            ? `Only ${available} of "${label}" ${available === 1 ? 'is' : 'are'} left. Please reduce the quantity to continue.`
            : `"${label}" just went out of stock. Please remove it from your cart to continue.`,
        details: {
          items: short.map((entry) => ({
            productId: entry.product._id.toString(),
            variantId: entry.variantId ? entry.variantId.toString() : null,
            name: entry.product.name,
            requested: entry.quantity,
            available: resolveStock(entry.product, entry.variantId),
          })),
        },
      },
    };
  }

  // Priced through the SAME resolver the cart used, at the same quantity, so
  // the number the buyer agreed to and the number they are charged cannot
  // diverge. Tax is snapshotted alongside it: a GST rate changing next month
  // must not rewrite the tax on an invoice already issued.
  //
  // GST: a product without its own rate is taxed at the admin's default. An
  // exclusive product has GST added on top of its listed price here, so
  // `price` on the order line is always the tax-inclusive amount paid — the
  // invoice, refunds and the ledger all read it that way.
  const settings = await PlatformSettings.getSettings();
  const items = cartEntries.map((entry) => {
    const variantId = entry.variantId ? entry.variantId.toString() : null;
    const variant = findVariant(entry.product, variantId);
    const { unitPrice, source } = resolveUnitPrice(entry.product, { variantId, quantity: entry.quantity });
    const gstRate = effectiveGstRate(entry.product, settings.defaultGstRate);
    const gstInclusive = entry.product.gstInclusive !== false;
    const unitPaise = grossUnitPaise(toPaise(unitPrice), { rate: gstRate, inclusive: gstInclusive });
    const tax = resolveLineTax({ gstRate }, (unitPaise * entry.quantity) / 100);

    return {
      product: entry.product._id,
      name: entry.product.name,
      image: variant?.image
        ? getImageUrl(variant.image)
        : entry.product.images?.[0]
          ? getImageUrl(entry.product.images[0])
          : null,
      price: unitPaise / 100,
      listPrice: unitPrice,
      gstInclusive,
      quantity: entry.quantity,
      variantId: variantId || null,
      variant: variant?.name || entry.variant || '',
      variantSku: variant?.sku || '',
      priceSource: source,
      hsnCode: entry.product.hsnCode || '',
      gstRate: tax.rate,
      taxableValue: tax.taxableValuePaise,
      taxAmount: tax.taxPaise,
      vendor: entry.product.vendor || null,
      returnable: entry.product.isReturnable !== false,
    };
  });

  // Summed in paise: a rupee float added across forty lines drifts.
  const linePaise = items.map((item) => toPaise(item.price) * item.quantity);
  const subtotal = linePaise.reduce((sum, p) => sum + p, 0) / 100;

  // CJ Dropshipping lines. Business rule: they are paid for online and only
  // online — no COD, no wallet — and a cart holding even one of them follows
  // that rule as a whole.
  const dropshipIds = await findDropshipProductIds(cartEntries.map((entry) => entry.product));
  const fulfillmentOf = (item) => (dropshipIds.has(String(item.product)) ? 'DROPSHIP' : 'STANDARD');
  const hasDropship = items.some((item) => fulfillmentOf(item) === 'DROPSHIP');
  if (hasDropship && String(paymentMethod || '').toUpperCase() !== 'RAZORPAY') {
    return {
      error: {
        status: 409,
        code: 'ONLINE_PAYMENT_REQUIRED',
        message:
          'Your cart has a dropshipping item, which can only be paid for online. Cash on delivery and wallet are not available for this order.',
      },
    };
  }

  // Any order that was not cancelled makes the buyer a returning customer.
  // Counting only PAID orders left a buyer whose orders were all COD (paid
  // only on delivery) "new" indefinitely, free to take a new-customer coupon
  // on order after order.
  const previousOrders = await Order.countDocuments({ user: user._id, status: { $ne: 'CANCELLED' } });
  const isNewCustomer = previousOrders === 0;

  let discountAmount = 0;
  let normalizedCouponCode = null;
  let appliedCoupon = null;
  const couponCartItems = items.map((item, idx) => ({
    productId: item.product,
    categoryId: cartEntries[idx].product?.category,
    vendorId: item.vendor,
    price: item.price,
    quantity: item.quantity,
  }));

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });
    if (!coupon) {
      return { error: { status: 400, message: 'Invalid coupon code' } };
    }

    const evaluation = await evaluateCoupon(coupon, {
      userId: user._id,
      cartItems: couponCartItems,
      cartTotal: subtotal,
      isNewCustomer,
    });
    if (!evaluation.valid) {
      return { error: { status: 400, message: evaluation.reason } };
    }

    discountAmount = evaluation.discountAmount;
    normalizedCouponCode = coupon.code;
    appliedCoupon = coupon;
  }

  // Priced AFTER the coupon, so free delivery is judged on the discounted amount.
  // Quoted from the carrier for THIS cart, THIS address and THIS payment
  // method. `cartEntries` is passed straight through so the quote cannot be
  // for a different basket than the one being priced.
  const quote = await checkoutQuoteService.quoteCart({
    entries: cartEntries,
    address,
    paymentMethod,
    // The free-delivery threshold is measured on what the buyer actually
    // pays for the goods — after the coupon. Measuring it before let a coupon
    // push a cart below the threshold and still ship free.
    subtotal: (toPaise(subtotal) - toPaise(discountAmount)) / 100,
    dropshipProductIds: dropshipIds,
  });

  if (!quote.ok) {
    // A rate we could not get must not silently become zero. Stopping is the
    // honest outcome — the alternative is shipping at a price nobody agreed to.
    return { error: { status: 409, code: quote.code, message: quote.message } };
  }

  const shipping = quote.shippingFee;

  // Each line's share of the discount, spread ONLY over the lines the coupon
  // applied to. Fixed here, once, and snapshotted on the order: refunds and
  // the seller ledger both read it, so a return pays back what was actually
  // paid, and one seller's coupon never comes out of another seller's line.
  const discountPaiseByLine = items.map(() => 0);
  if (appliedCoupon && discountAmount > 0) {
    const eligible = new Set(filterEligibleItems(appliedCoupon, couponCartItems));
    const eligibleIndexes = couponCartItems.map((ci, idx) => (eligible.has(ci) ? idx : -1)).filter((idx) => idx >= 0);
    const shares = allocateProportional(
      toPaise(discountAmount),
      eligibleIndexes.map((idx) => linePaise[idx])
    );
    eligibleIndexes.forEach((idx, k) => {
      discountPaiseByLine[idx] = shares[k];
    });
  }
  items.forEach((item, idx) => {
    item.discountAmount = discountPaiseByLine[idx] / 100;
  });

  // One order per fulfilment type. A cart of only seller products is one
  // STANDARD order exactly as before; a mixed cart becomes a STANDARD and a
  // DROPSHIP order, each with its own lines, discount and delivery charge.
  const shippingBy = quote.shippingByFulfillment || { STANDARD: shipping, DROPSHIP: 0 };

  // The buyer's platform fee: a percentage of the goods after the coupon, or
  // a flat amount per checkout. Charged once, on the checkout's first order.
  const feeValue = Math.max(0, Number(settings.buyerPlatformFeeValue) || 0);
  const goodsPaise = Math.max(0, toPaise(subtotal) - toPaise(discountAmount));
  const platformFeePaise =
    feeValue <= 0
      ? 0
      : settings.buyerPlatformFeeType === 'flat'
        ? toPaise(feeValue)
        : Math.round((goodsPaise * feeValue) / 100);

  const orderGroups = ['STANDARD', 'DROPSHIP']
    .map((fulfillmentType) => {
      const indexes = items.map((item, idx) => idx).filter((idx) => fulfillmentOf(items[idx]) === fulfillmentType);
      if (indexes.length === 0) return null;

      const subtotalPaise = indexes.reduce((sum, idx) => sum + linePaise[idx], 0);
      const discountPaise = indexes.reduce((sum, idx) => sum + discountPaiseByLine[idx], 0);
      const shippingPaise = toPaise(shippingBy[fulfillmentType] || 0);
      return {
        fulfillmentType,
        items: indexes.map((idx) => items[idx]),
        subtotal: subtotalPaise / 100,
        discountAmount: discountPaise / 100,
        shippingFee: shippingPaise / 100,
        total: Math.max(0, subtotalPaise - discountPaise + shippingPaise) / 100,
      };
    })
    .filter(Boolean)
    .map((group, index) => {
      const feePaise = index === 0 ? platformFeePaise : 0;
      return {
        ...group,
        platformFee: feePaise / 100,
        total: (toPaise(group.total) + feePaise) / 100,
      };
    });

  // What the buyer is shown: the goods at their listed prices, the GST in
  // them (included in the price, or added on top), and the platform fee.
  const listSubtotalPaise = items.reduce((sum, item) => sum + toPaise(item.listPrice) * item.quantity, 0);
  const gstIncludedPaise = items.reduce((sum, item) => sum + (item.gstInclusive ? item.taxAmount : 0), 0);
  const gstAddedPaise = toPaise(subtotal) - listSubtotalPaise;
  const taxBreakdown = {
    listSubtotal: listSubtotalPaise / 100,
    gstIncluded: gstIncludedPaise / 100,
    gstAdded: gstAddedPaise / 100,
    gstTotal: items.reduce((sum, item) => sum + item.taxAmount, 0) / 100,
    lines: items.map((item) => ({
      productId: String(item.product),
      variantId: item.variantId,
      name: item.name,
      quantity: item.quantity,
      listPrice: item.listPrice,
      price: item.price,
      gstRate: item.gstRate,
      gstInclusive: item.gstInclusive,
      gstAmount: item.taxAmount / 100,
    })),
  };

  // The amount charged is exactly the sum of the orders it pays for.
  const total = orderGroups.reduce((sum, group) => sum + toPaise(group.total), 0) / 100;

  return {
    address,
    items,
    subtotal,
    shipping,
    // Carried out so the quote endpoint can explain the number rather than
    // just stating it.
    quote,
    discountAmount,
    normalizedCouponCode,
    platformFee: platformFeePaise / 100,
    taxBreakdown,
    total,
    orderGroups,
    hasDropship,
    couponCartItems,
    isNewCustomer,
  };
}

// Atomically decrements stock for every item, all-or-nothing: if any item
// doesn't have enough stock left, everything already decremented in this
// call is put back before returning. This is the only place order stock is
// ever touched, so two concurrent checkouts for the last unit can never
// both succeed.
// Atomic, and variant-aware. A line with a variant decrements THAT variant's
// stock through a positional match, so two buyers racing for the last Red/L
// cannot both win just because the parent product still had stock in other
// colours.
//
// The filter is part of the update, not a check before it - that is what makes
// it atomic. A findOneAndUpdate matching nothing means someone else got there
// first.
async function reserveStock(items) {
  const reserved = [];
  for (const item of items) {
    const updated = item.variantId
      ? await Product.findOneAndUpdate(
          {
            _id: item.product,
            variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } },
          },
          { $inc: { 'variants.$.stock': -item.quantity } }
        )
      : await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );

    if (!updated) {
      await releaseStock(reserved);
      return { ok: false, productName: item.variant ? `${item.name} (${item.variant})` : item.name };
    }
    reserved.push(item);
  }
  return { ok: true };
}

// The mirror image of reserveStock, and it has to stay that way: a variant
// reservation must be given back to THAT variant. Crediting the parent instead
// would quietly inflate the parent's stock every time a payment failed, while
// the variant that was actually held stayed short.
async function releaseStock(items) {
  if (!items || items.length === 0) return;
  await Promise.all(
    items.map((item) =>
      item.variantId
        ? Product.updateOne(
            { _id: item.product, 'variants._id': item.variantId },
            { $inc: { 'variants.$.stock': item.quantity } }
          )
        : Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    )
  );
}

// One notification per distinct vendor represented in the order, not one per
// item — a seller with 3 of their SKUs in the same cart gets a single "New
// order received" ping (in-app + push + WhatsApp), not three. See
// services/vendorAlertService.
async function notifyVendorsOfNewOrder(items, orderId) {
  await vendorAlerts.notifyVendorsOfNewOrder({ _id: orderId, items });
}

// POST /user/orders/razorpay-order — mirrors walletController.createTopupOrder
// but for a checkout payment rather than a wallet top-up; kept separate so a
// wallet-topup Razorpay order can never be replayed to pay for an order. The
// amount is always the server-computed total for the caller's own cart —
// never a client-supplied figure — so the payment collected by Razorpay can
// later be checked against this same computation in createOrder.
async function createRazorpayOrder(req, res) {
  const { addressId, couponCode } = req.body;

  // A Razorpay order is prepaid by definition, so it is quoted at the prepaid
  // rate. The client does not get to say.
  const checkout = await computeCheckoutTotals(req.user, {
    addressId,
    couponCode,
    paymentMethod: 'RAZORPAY',
  });
  if (checkout.error) {
    return res.status(checkout.error.status).json(serializeCheckoutError(checkout.error));
  }
  if (checkout.total <= 0) {
    return res.status(400).json({ success: false, message: 'Nothing to pay for this order' });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(checkout.total * 100),
    currency: 'INR',
    receipt: `order_${req.user._id}_${Date.now()}`,
    notes: { purpose: 'ORDER_PAYMENT', userId: req.user._id.toString() },
  });

  // Remembered so a checkout that never turns into an order (payment failed,
  // popup closed) gets one "complete your payment" reminder — see
  // Jobs/engagementJob. Best-effort: a reminder is never worth failing checkout.
  try {
    await CheckoutAttempt.create({ user: req.user._id, razorpayOrderId: order.id, amount: checkout.total });
  } catch (err) {
    console.error('[createRazorpayOrder] could not record checkout attempt:', err.message);
  }

  res.json({
    success: true,
    data: { razorpayOrderId: order.id, amount: checkout.total, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID },
  });
}

// POST /user/orders — the only place an Order document is ever created.
// Cart items and their prices are read server-side (never trusted from the
// client), payment is verified/settled and stock is reserved BEFORE the
// order is written so a failed payment or an out-of-stock item never leaves
// a paid-looking order behind, and a coupon (if any) is redeemed against the
// order's real _id via couponController's existing evaluateCoupon/
// redeemCoupon engine.
async function createOrder(req, res) {
  const {
    addressId,
    paymentMethod,
    couponCode,
    b2b,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  } = req.body;

  if (!Order.PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Select a valid payment method' });
  }

  const paymentSettings = await PaymentSettings.getSettings();
  if (!paymentSettings[PaymentSettings.FIELD_BY_METHOD[paymentMethod]]) {
    return res.status(400).json({ success: false, message: 'This payment method is currently unavailable' });
  }

  // Accepted from either the standard header or the body so a WebView client
  // that can't easily set headers still gets the protection.
  const idempotencyKey = normaliseIdempotencyKey(
    req.get('Idempotency-Key') || req.body.idempotencyKey
  );

  // Fast path: the retry arrives after the first call already committed. The
  // unique index below is still the real guarantee (this read can lose a race
  // with a request that hasn't committed yet) — this just avoids doing the
  // whole payment/stock dance again in the common case.
  if (idempotencyKey) {
    const existing = await Order.find({ user: req.user._id, idempotencyKey }).sort({ checkoutGroupIndex: 1 });
    if (existing.length > 0) {
      return res.status(200).json(placedResponse(existing, 'Order already placed'));
    }
  }

  // Quoted at the method being paid with — COD costs more to ship, and that
  // difference has to be in the total the buyer is actually charged.
  const checkout = await computeCheckoutTotals(req.user, { addressId, couponCode, paymentMethod });
  if (checkout.error) {
    return res.status(checkout.error.status).json(serializeCheckoutError(checkout.error));
  }
  const {
    address,
    items,
    subtotal,
    shipping,
    normalizedCouponCode,
    total,
    orderGroups,
    quote,
    couponCartItems,
    isNewCustomer,
  } = checkout;

  let paymentStatus = 'PENDING';
  let capturedPayment = null;

  if (paymentMethod === 'RAZORPAY') {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // The signature only proves this (orderId, paymentId) pair is genuine —
    // it says nothing about the amount actually captured. Re-fetch the
    // payment from Razorpay and require it to match this cart's
    // server-computed total, so a payment captured for a different
    // (smaller) amount can never be replayed to pay for a bigger cart.
    try {
      capturedPayment = await razorpay.payments.fetch(razorpayPaymentId);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Unable to verify payment with Razorpay' });
    }
    if (
      !capturedPayment ||
      capturedPayment.order_id !== razorpayOrderId ||
      capturedPayment.status !== 'captured' ||
      capturedPayment.amount !== Math.round(total * 100)
    ) {
      return res.status(400).json({ success: false, message: 'Payment amount could not be verified' });
    }
    paymentStatus = 'PAID';
  }

  const reservation = await reserveStock(items);
  if (!reservation.ok) {
    if (paymentMethod === 'RAZORPAY' && capturedPayment) {
      // Real money was already captured by Razorpay before this endpoint
      // ran — refund it automatically since we can't fulfil the order.
      try {
        await razorpay.payments.refund(razorpayPaymentId, { amount: capturedPayment.amount, speed: 'optimum' });
      } catch (refundErr) {
        console.error('Auto-refund after stock-out failed, needs manual reconciliation:', {
          razorpayPaymentId,
          error: refundErr.message,
        });
      }
      return res.status(409).json({
        success: false,
        message: `"${reservation.productName}" just went out of stock. Your payment is being refunded automatically.`,
      });
    }
    return res.status(409).json({ success: false, message: `"${reservation.productName}" just went out of stock.` });
  }

  if (paymentMethod === 'WALLET') {
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: total } },
      { $inc: { walletBalance: -total } },
      { new: true }
    );
    if (!updatedCustomer) {
      await releaseStock(items);
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }
    paymentStatus = 'PAID';
  }

  // One order per fulfilment type — see computeCheckoutTotals. They share the
  // payment, the idempotency key and a checkout group id; index 0 is the
  // primary.
  const checkoutGroupId = crypto.randomUUID();
  const shippingAddress = {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  };
  const b2bSnapshot =
    b2b && b2b.isB2B
      ? {
          isB2B: true,
          companyName: typeof b2b.companyName === 'string' ? b2b.companyName.trim() : '',
          gstin: typeof b2b.gstin === 'string' ? b2b.gstin.trim().toUpperCase() : '',
        }
      : { isB2B: false, companyName: '', gstin: '' };

  let orders;
  try {
    // ordered: the first failure stops the batch, and anything already
    // written is removed below, so a checkout never ends up half-placed.
    // Each seller line's commission terms are frozen onto it here, at
    // checkout, so a rule edited later cannot change what it is charged.
    orders = await Order.insertMany(
      await accounting.attachCommissionSnapshots(orderGroups.map((group, index) => ({
        user: req.user._id,
        items: group.items,
        shippingAddress,
        subtotal: group.subtotal,
        discountAmount: group.discountAmount,
        couponCode: normalizedCouponCode,
        shippingFee: group.shippingFee,
        platformFee: group.platformFee,
        total: group.total,
        paymentMethod,
        paymentStatus,
        razorpayOrderId: paymentMethod === 'RAZORPAY' ? razorpayOrderId : null,
        razorpayPaymentId: paymentMethod === 'RAZORPAY' ? razorpayPaymentId : null,
        idempotencyKey,
        fulfillmentType: group.fulfillmentType,
        checkoutGroupId,
        checkoutGroupIndex: index,
        cjLogisticName: group.fulfillmentType === 'DROPSHIP' ? quote?.cjLogisticName || null : null,
        b2b: b2bSnapshot,
        status: 'PENDING',
      }))),
      { ordered: true }
    );
  } catch (err) {
    await Order.deleteMany({ checkoutGroupId });
    await releaseStock(items);
    if (paymentMethod === 'WALLET') {
      await Customer.updateOne({ _id: req.user._id }, { $inc: { walletBalance: total } });
    }
    if (err.code === 11000) {
      // Lost the race against a concurrent identical submission (a double
      // tap, or the same request retried after a timeout). Everything this
      // call reserved has just been released above, and the winner's orders
      // are already committed — hand those back so the buyer sees them, not
      // an error.
      if (idempotencyKey) {
        const winners = await Order.find({ user: req.user._id, idempotencyKey }).sort({ checkoutGroupIndex: 1 });
        if (winners.length > 0) {
          return res.status(200).json(placedResponse(winners, 'Order already placed'));
        }
      }
      // A razorpayPaymentId collision with no matching idempotency key is
      // NOT treated as a retry: the same captured payment being presented
      // again under a different checkout attempt is exactly the replay this
      // index exists to stop, so it stays a hard 409.
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_ORDER',
        message: 'This payment has already been used for another order',
      });
    }
    throw err;
  }
  const order = orders[0];

  if (paymentMethod === 'WALLET') {
    const freshCustomer = await Customer.findById(req.user._id);
    await WalletTransaction.create({
      user: req.user._id,
      type: 'DEBIT',
      amount: total,
      balanceAfter: freshCustomer.walletBalance,
      source: 'ORDER_PAYMENT',
      orderId: order._id,
      status: 'SUCCESS',
    });
  }

  if (normalizedCouponCode) {
    try {
      await redeemCoupon({
        code: normalizedCouponCode,
        userId: req.user._id,
        orderId: order._id,
        cartItems: couponCartItems,
        cartTotal: subtotal,
        shippingFee: shipping,
        isNewCustomer,
      });
    } catch (err) {
      // The coupon passed evaluateCoupon a moment ago but lost a race on
      // usageLimit/perUserLimit before redeemCoupon's transaction committed.
      // The payment already succeeded, so the order still goes through —
      // it just keeps its already-computed discount without a recorded
      // redemption, rather than failing an otherwise-paid order.
    }
  }

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  await createNotification({
    userId: req.user._id,
    type: 'ORDER',
    title: 'Order Placed',
    message:
      orders.length > 1
        ? `Your ${orders.length} orders for ${items.length} item(s) worth ₹${total.toLocaleString('en-IN')} have been placed successfully.`
        : `Your order for ${items.length} item(s) worth ₹${total.toLocaleString('en-IN')} has been placed successfully.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  // A prepaid order's money is in hand right now, so its sale, commission and
  // gateway fee post immediately. A COD order posts nothing yet — the cash is
  // still with the courier until an admin records the remittance (task §12).
  // Posted BEFORE CJ is asked: if CJ refuses and the order is refunded, the
  // refund needs a posted sale to reverse.
  for (const placed of orders) {
    await postAccounting('order sale', () => accounting.postOrderSale(placed.toObject()));
  }

  for (const placed of orders) {
    if (placed.fulfillmentType === 'DROPSHIP') {
      // Sent to CJ; if CJ definitely refuses, the buyer is refunded to their
      // original payment automatically. Never throws.
      await dropshipOrderService.fulfil(placed);
    } else {
      await notifyVendorsOfNewOrder(placed.items, placed._id);
      // Shiprocket auto-dispatch for domestic multi-vendor items:
      // Partitions items seller-wise and creates separate Shiprocket shipments
      // using each seller's warehouse as the pickup location under Admin's Shiprocket account.
      await autoCreateShipmentsForOrder(placed, placed.items);
    }
  }

  if (total >= highValueThreshold()) {
    await alertAdmins({
      event: 'HIGH_VALUE_ORDER',
      title: 'High-value order placed',
      message: `ORD-${String(order._id).slice(-8).toUpperCase()} worth ₹${total.toLocaleString('en-IN')} (${paymentMethod}) by ${order.shippingAddress?.fullName || 'a customer'}.`,
      link: `/admin/orders/detail/${order._id}`,
      key: `HIGH_VALUE_ORDER:${order._id}`,
    });
  }

  // Re-read: fulfilment may have cancelled and refunded the dropship order.
  const fresh = await Order.find({ checkoutGroupId }).sort({ checkoutGroupIndex: 1 });
  res.status(201).json(placedResponse(fresh, 'Order placed successfully'));
}

// `data` stays the first order, exactly the shape every existing client
// reads; `orders` lists every order the checkout produced (two for a cart
// split into a dropship and a standard order).
function placedResponse(orders, message) {
  const serialized = orders.map(serializeOrder);
  return { success: true, message, data: { ...serialized[0], orders: serialized } };
}

// One Shiprocket parcel per seller on the order — and one for Krozenda's own
// stock (lines with no vendor), which used to be skipped entirely: every
// own-stock order was placed and never reached Shiprocket.
//
// A parcel that cannot be created (no pickup location, carrier refused) is
// not the buyer's problem at checkout, but it must not be silent either: the
// admin is alerted with the reason, and the seller is told when it is theirs
// to fix.
async function autoCreateShipmentsForOrder(order, items) {
  try {
    const shipmentService = require('../services/shipping/shipmentService');
    const groups = [...new Set(items.map((i) => (i.vendor ? i.vendor.toString() : '')))];

    for (const key of groups) {
      const vendorId = key || null;
      const groupItems = items.filter((i) => (i.vendor ? i.vendor.toString() : '') === key);
      const firstItemProductId = groupItems[0]?.product || groupItems[0]?.productId;
      const isCj = await ProductFulfillmentMapping.exists({ product: firstItemProductId, provider: 'CJ' });
      if (isCj) continue; // Handled by CJ dropshipping pipeline

      const label = vendorId ? `vendor ${vendorId}` : 'Krozenda stock';
      let res;
      try {
        res = await shipmentService.createShipment({ orderId: order._id, vendorId, actor: 'SYSTEM' });
      } catch (shipmentErr) {
        res = { ok: false, reason: 'ERROR', message: shipmentErr.message };
      }
      if (res.ok) {
        console.log(`[SHIPPING] Auto-created Shiprocket shipment ${res.shipment?._id} for order ${order._id}, ${label}`);
        continue;
      }
      // The shipping services report why as `code`; the account resolver as `reason`.
      const why = res.code || res.reason || 'ERROR';
      // Shipping switched off is a setting, not a failure.
      if (why === 'SHIPPING_DISABLED') {
        console.warn(`[SHIPPING] Shiprocket auto-shipment skipped for order ${order._id}, ${label}: ${res.message}`);
        continue;
      }
      console.warn(`[SHIPPING] Shiprocket auto-shipment failed for order ${order._id}, ${label}: ${why} ${res.message}`);
      await alertAdmins({
        event: 'AUTO_SHIPMENT_FAILED',
        title: 'Order not sent to Shiprocket',
        message: `ORD-${String(order._id).slice(-8).toUpperCase()} (${label}): ${res.message || why}. Create the shipment from the order once fixed.`,
        link: `/admin/orders/detail/${order._id}`,
        key: `AUTO_SHIPMENT_FAILED:${order._id}:${key || 'platform'}`,
      });
      if (vendorId && ['NO_PICKUP_LOCATION', 'PICKUP_NOT_REGISTERED'].includes(why)) {
        await createNotification({
          vendorId,
          type: 'ORDER',
          title: 'Add a pickup address to ship this order',
          message: `Order ORD-${String(order._id).slice(-8).toUpperCase()} could not be booked with the courier: ${res.message}`,
          actionType: 'ORDER',
          actionRefId: order._id,
        });
      }
    }
  } catch (err) {
    console.error(`[SHIPPING] autoCreateShipmentsForOrder failed for order ${order._id}:`, err.message);
  }
}

// A list row only needs enough to render the card — who it was, what it cost,
// where it is, and a thumbnail strip. Sending the full serializeOrder payload
// (every line item's snapshot, the whole shipping address, the complete status
// history) for every order the buyer has ever placed made this endpoint grow
// without bound; OrderDetailsScreen fetches the full document by id anyway.
function serializeOrderSummary(o) {
  return {
    id: o._id.toString(),
    itemCount: o.items.length,
    // First three thumbnails is what the card shows; the rest is dead weight.
    previewItems: o.items.slice(0, 3).map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      quantity: item.quantity,
    })),
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    isDropship: o.fulfillmentType === 'DROPSHIP',
    // Drives the buyer's Return / Replace button.
    canReturn: canRequestReturn(o),
    deliveredAt: o.deliveredAt,
    createdAt: o.createdAt,
  };
}

async function listOrders(req, res) {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status && Order.STATUSES.includes(status)) {
    filter.status = status;
  }

  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items: orders.map(serializeOrderSummary) },
    pagination: buildPagination({ page, limit, total }),
  });
}

async function getOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOne({ _id: id, user: req.user._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: serializeOrder(order) });
}

// PATCH /user/orders/:id/cancel — a user may only cancel their own order,
// and only while it's still in a state that hasn't shipped yet. Restores
// stock and, for a paid order, refunds to the wallet — both exactly once,
// enforced by the atomic status-guarded findOneAndUpdate below rather than
// a read-then-write check (so a double-click / retry can't double-refund).
const USER_CANCELLABLE_STATUSES = ['PENDING', 'PROCESSING'];

async function cancelOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  // Business rule: a dropshipping order is sent to the supplier the moment it
  // is paid for, and the buyer cannot cancel it. Checked before the update so
  // nothing is touched when it is refused.
  const target = await Order.findOne({ _id: id, user: req.user._id })
    .select('fulfillmentType checkoutGroupId items.product')
    .lean();
  if (target && (await isDropshipOrder(target))) {
    return res.status(403).json({
      success: false,
      code: 'DROPSHIP_NOT_CANCELLABLE',
      message: 'Dropshipping orders cannot be cancelled once placed.',
    });
  }

  const order = await Order.findOneAndUpdate(
    { _id: id, user: req.user._id, status: { $in: USER_CANCELLABLE_STATUSES } },
    // The lines go with the order: the seller's panel reads a line's status,
    // and a cancelled order showing a PROCESSING line invites shipping it.
    {
      $set: { status: 'CANCELLED', cancelledBy: 'buyer', 'items.$[live].status': 'CANCELLED' },
      $push: { statusHistory: { status: 'CANCELLED', at: new Date() } },
    },
    { new: false, arrayFilters: [{ 'live.status': { $nin: ['CANCELLED', 'DELIVERED'] } }] }
  );

  if (!order) {
    const exists = await Order.exists({ _id: id, user: req.user._id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? 'This order can no longer be cancelled' : 'Order not found',
    });
  }

  // Only lines still live: a line cancelled on its own already gave its stock back.
  await releaseStock(order.items.filter((item) => item.status !== 'CANCELLED'));

  if (order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD') {
    // What is still owed: lines cancelled on their own were refunded already.
    await refundCancelledOrderToWallet(order);

    // Reverse whatever was posted for this order. The original SALE rows stay
    // exactly as they were — this writes REFUND debits against them and hands
    // the commission back (task §15 Rules 1 and 3).
    await postAccounting('cancellation refund', () =>
      accounting.postOrderCancellationRefund({ order: { ...order.toObject(), paymentStatus: 'REFUNDED' } })
    );
  }

  // The coupon slot comes back once nothing bought with it is still live.
  await dropshipOrderService.releaseCouponIfWholeCheckoutCancelled({ ...order.toObject(), status: 'CANCELLED' });

  // Stop the courier: the Shiprocket parcel for this order is cancelled too.
  await require('../services/shipping/shipmentService').cancelShipmentsForOrder({
    orderId: order._id,
    reason: 'Cancelled by buyer',
    actor: 'BUYER',
  });

  await createNotification({
    userId: req.user._id,
    type: 'ORDER',
    title: 'Order Cancelled',
    message: `Your order worth ₹${order.total.toLocaleString('en-IN')} has been cancelled.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  res.json({ success: true, message: 'Order cancelled successfully' });
}

// GET /user/orders/:id/tracking
//
// The buyer's view of where their parcels are. Deliberately narrow, because
// the buyer is the least-privileged reader in the system:
//
//   * scoped to `req.user._id`, so someone else's order id returns 404
//   * NO carrier call — it reads the stored timeline, same as the seller's
//     tracking read. A buyer refreshing a page must never spend the seller's
//     carrier rate limit
//   * no seller identity, no carrier account, no costs, no internal status
//     codes. The 22-state machine is collapsed to the five states a buyer
//     understands, via BUYER_FACING_ORDER_STATUS
// GET /user/orders/:id/invoice — the buyer's tax invoice(s): one per supplier
// (Krozenda for own-stock and CJ items, each seller for theirs), each with
// that supplier's GSTIN. See services/invoiceService.
async function getOrderInvoice(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  res.json({ success: true, data: await buildInvoices(order) });
}

async function getOrderTracking(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOne({ _id: id, user: req.user._id }).select('_id status createdAt');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const shipments = await Shipment.find({ order: order._id }).sort({ createdAt: 1 });

  const parcels = await Promise.all(
    shipments.map(async (shipment) => ({
      id: shipment._id.toString(),
      // "Parcel 1 of 2" — a multi-vendor order genuinely arrives in pieces,
      // and hiding that makes a partial delivery look like a lost order.
      type: shipment.shipmentType,
      status: BUYER_FACING_ORDER_STATUS[shipment.internalStatus] || 'PROCESSING',
      // The courier's name and AWB are what a buyer needs to chase a parcel
      // themselves; both are already printed on the package.
      courierName: shipment.courierName || '',
      awbCode: shipment.awbCode || null,
      trackingUrl: shipment.trackingUrl || null,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt,
      shippedAt: shipment.pickedUpAt,
      deliveredAt: shipment.deliveredAt,
      items: shipment.items.map((item) => ({
        productId: item.product.toString(),
        name: item.name,
        quantity: item.quantity,
      })),
      events: await trackingService.getTimeline(shipment),
    }))
  );

  res.json({
    success: true,
    message: 'Tracking fetched successfully',
    data: {
      orderId: order._id.toString(),
      orderStatus: order.status,
      // An order with no shipment yet is not an error — it simply has not been
      // handed to a courier. The client shows "Preparing your order", not an
      // empty tracking screen.
      hasShipments: parcels.length > 0,
      parcels,
    },
  });
}

// POST /user/orders/shipping-quote
//
// What shipping costs for this cart — for EVERY payment method, in one call.
//
// Quoting only the selected method meant a buyer had to click COD to discover
// it costs more, which is exactly the moment they should have been able to
// compare. Two computations cover all three methods: Wallet is prepaid, so it
// shares Razorpay's number.
//
// It runs the SAME computeCheckoutTotals the order will run, so what is shown
// is what gets charged — not a second implementation that can drift.
async function getShippingQuote(req, res) {
  const { addressId, paymentMethod, couponCode } = req.body;

  const selected = Order.PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'RAZORPAY';

  // The carrier is asked about one lane; the second call answers from
  // serviceabilityService's 5-minute lane cache, so this is not twice the cost.
  const [prepaid, cod] = await Promise.all([
    computeCheckoutTotals(req.user, { addressId, couponCode, paymentMethod: 'RAZORPAY' }),
    computeCheckoutTotals(req.user, { addressId, couponCode, paymentMethod: 'COD' }),
  ]);

  // A failure that is not about COD (empty cart, bad address, unserviceable
  // lane) fails the whole request — there is nothing to show.
  if (prepaid.error) {
    return res.status(prepaid.error.status).json(serializeCheckoutError(prepaid.error));
  }

  const describe = (result) => {
    if (!result || result.error) {
      // COD specifically can be unavailable while prepaid is fine — it is
      // switched off, or no courier does COD on this lane. That is a real
      // answer for that row, not a failure of the screen.
      return { available: false, reason: result?.error?.code || 'UNAVAILABLE', message: result?.error?.message || '' };
    }
    return {
      available: true,
      shippingFee: result.shipping,
      total: result.total,
      isFree: result.shipping === 0,
      // What the marketplace absorbs on a free order — worth showing, because
      // "FREE" with no context reads as a gimmick.
      carrierCost: result.quote?.carrierCost ?? result.shipping,
      estimatedDeliveryDays: result.quote?.estimatedDeliveryDays ?? null,
    };
  };

  const prepaidView = describe(prepaid);
  const codView = describe(cod);

  // Wallet is prepaid money, so it ships at the prepaid rate — except that a
  // cart with a dropshipping item can only be paid online at all.
  const walletView = prepaid.hasDropship
    ? {
        available: false,
        reason: 'ONLINE_PAYMENT_REQUIRED',
        message: 'Dropshipping items can only be paid for online.',
      }
    : prepaidView;
  const byMethod = { RAZORPAY: prepaidView, WALLET: walletView, COD: codView };
  const chosen = byMethod[selected] || prepaidView;

  res.json({
    success: true,
    message: 'Shipping quote',
    data: {
      paymentMethod: selected,
      subtotal: prepaid.subtotal,
      discountAmount: prepaid.discountAmount,
      couponCode: prepaid.normalizedCouponCode,
      // Priced on the goods, so the same whichever way the buyer pays.
      platformFee: prepaid.platformFee,
      // Listed prices, GST included in them / added on top, and per line.
      tax: prepaid.taxBreakdown,

      // The selected method's numbers, kept at the top level so a screen that
      // only cares about the current choice does not have to look them up.
      shippingFee: chosen.available ? chosen.shippingFee : 0,
      total: chosen.available ? chosen.total : prepaid.total,
      isFree: Boolean(chosen.available && chosen.isFree),
      carrierCost: chosen.available ? chosen.carrierCost : 0,
      estimatedDeliveryDays: chosen.available ? chosen.estimatedDeliveryDays : null,

      // Every method, so the buyer can compare before choosing rather than
      // after.
      methods: byMethod,

      // A cart with a dropshipping item: Razorpay only, and — when it also
      // has seller items — placed as more than one order.
      onlineOnly: Boolean(prepaid.hasDropship),
      orderCount: prepaid.orderGroups?.length ?? 1,
      freeReason: prepaid.quote?.freeReason ?? null,
      freeShippingThreshold: prepaid.quote?.freeShippingThreshold ?? 0,
      amountToFreeShipping: prepaid.quote?.amountToFreeShipping ?? 0,
      parcelCount: prepaid.quote?.parcelCount ?? 1,
    },
  });
}

// GET /user/orders/payment-methods — which of COD/RAZORPAY/WALLET the admin
// currently allows, so the checkout screen can hide the rest instead of
// letting the buyer pick one createOrder will then reject.
async function getPaymentMethods(req, res) {
  const settings = await PaymentSettings.getSettings();
  res.json({
    success: true,
    data: {
      methods: Order.PAYMENT_METHODS.reduce((acc, method) => {
        acc[method] = Boolean(settings[PaymentSettings.FIELD_BY_METHOD[method]]);
        return acc;
      }, {}),
    },
  });
}

// POST /user/orders/:id/reorder — B2B/quick repeat purchase: reads items from
// an existing order, checks current stock and availability, and merges all
// available items into the buyer's cart.
async function reorder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOne({ _id: id, user: req.user._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!order.items || order.items.length === 0) {
    return res.status(400).json({ success: false, message: 'This order has no items to reorder' });
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  let addedCount = 0;
  const skippedItems = [];
  const hideOwnStock = !(await isOwnStockVisibleToCustomers());

  for (const item of order.items) {
    const product = await Product.findOne({ _id: item.product, isActive: true });
    if (!product || (hideOwnStock && isOwnStockProduct(product))) {
      skippedItems.push({ name: item.name, reason: 'Product is no longer available' });
      continue;
    }

    const variantId = item.variantId ? item.variantId.toString() : null;
    const availableStock = resolveStock(product, variantId);

    if (availableStock <= 0) {
      skippedItems.push({ name: item.name, reason: 'Out of stock' });
      continue;
    }

    const qtyToAdd = Math.min(item.quantity, availableStock);

    const existingIndex = cart.items.findIndex(
      (entry) =>
        entry.product.toString() === product._id.toString() &&
        String(entry.variantId || '') === String(variantId || '')
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity = Math.min(availableStock, cart.items[existingIndex].quantity + qtyToAdd);
    } else {
      cart.items.push({
        product: product._id,
        quantity: qtyToAdd,
        variantId: variantId || null,
        variant: item.variant || '',
        priceAtAdd: resolveUnitPrice(product, { variantId, quantity: qtyToAdd }).unitPrice,
      });
    }
    addedCount++;
  }

  await cart.save();

  res.json({
    success: true,
    message:
      addedCount > 0
        ? `${addedCount} item(s) added to cart`
        : 'None of the items from this order are currently available',
    data: {
      addedCount,
      skippedItems,
      cartItemCount: cart.items.length,
    },
  });
}

module.exports = {
  getShippingQuote,
  getPaymentMethods,
  // Exported so the checkout price can be tested directly. It is the single
  // place the total is decided, so testing it is testing what gets charged.
  computeCheckoutTotals,
  serializeOrderSummary,
  createRazorpayOrder,
  createOrder,
  listOrders,
  getOrder,
  getOrderInvoice,
  cancelOrder,
  getOrderTracking,
  reorder,
  serializeOrder,
  releaseStock,
  reserveStock,
  notifyVendorsOfNewOrder,
};

