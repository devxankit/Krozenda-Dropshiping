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
const { evaluateCoupon, redeemCoupon } = require('./couponController');
const { createNotification } = require('./notificationController');
const Shipment = require('../Models/Shipment');
const trackingService = require('../services/shipping/trackingService');
const { BUYER_FACING_ORDER_STATUS } = require('../Config/shipping');
const PaymentSettings = require('../Models/PaymentSettings');
const checkoutQuoteService = require('../services/shipping/checkoutQuoteService');
const { getImageUrl } = require('../utils/imageHelper');
const {
  checkMoq,
  findVariant,
  requiresVariant,
  resolveLineTax,
  resolveStock,
  resolveUnitPrice,
} = require('../utils/pricing');
const accounting = require('../services/accountingPosting');
const { readPagination, buildPagination } = require('../utils/pagination');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const cjOrderService = require('../services/cj/cjOrderService');

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
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
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
  const unavailable = allEntries.filter((entry) => !entry.product || !entry.product.isActive);
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
  const items = cartEntries.map((entry) => {
    const variantId = entry.variantId ? entry.variantId.toString() : null;
    const variant = findVariant(entry.product, variantId);
    const { unitPrice, source } = resolveUnitPrice(entry.product, { variantId, quantity: entry.quantity });
    const tax = resolveLineTax(entry.product, unitPrice * entry.quantity);

    return {
      product: entry.product._id,
      name: entry.product.name,
      image: variant?.image
        ? getImageUrl(variant.image)
        : entry.product.images?.[0]
          ? getImageUrl(entry.product.images[0])
          : null,
      price: unitPrice,
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
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Quoted from the carrier for THIS cart, THIS address and THIS payment
  // method. `cartEntries` is passed straight through so the quote cannot be
  // for a different basket than the one being priced.
  const quote = await checkoutQuoteService.quoteCart({
    entries: cartEntries,
    address,
    paymentMethod,
    subtotal,
  });

  if (!quote.ok) {
    // A rate we could not get must not silently become zero. Stopping is the
    // honest outcome — the alternative is shipping at a price nobody agreed to.
    return { error: { status: 409, code: quote.code, message: quote.message } };
  }

  const shipping = quote.shippingFee;
  const previousOrders = await Order.countDocuments({ user: user._id, paymentStatus: 'PAID' });
  const isNewCustomer = previousOrders === 0;

  let discountAmount = 0;
  let normalizedCouponCode = null;
  const couponCartItems = cartEntries.map((entry) => ({
    productId: entry.product._id,
    categoryId: entry.product.category,
    price: entry.product.salePrice ?? entry.product.price ?? 0,
    quantity: entry.quantity,
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
      shippingFee: shipping,
      isNewCustomer,
    });
    if (!evaluation.valid) {
      return { error: { status: 400, message: evaluation.reason } };
    }

    discountAmount = evaluation.discountAmount;
    normalizedCouponCode = coupon.code;
  }

  const total = Math.max(0, subtotal - discountAmount + shipping);

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
    total,
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
// order received" ping, not three.
async function notifyVendorsOfNewOrder(items, orderId) {
  const vendorIds = [...new Set(items.filter((item) => item.vendor).map((item) => item.vendor.toString()))];
  await Promise.all(
    vendorIds.map((vendorId) =>
      createNotification({
        vendorId,
        type: 'ORDER',
        title: 'New Order Received',
        message: `You have a new order for ${items.filter((i) => i.vendor?.toString() === vendorId).length} of your product(s).`,
        actionType: 'ORDER',
        actionRefId: orderId,
      })
    )
  );
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
    const existing = await Order.findOne({ user: req.user._id, idempotencyKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Order already placed',
        data: serializeOrder(existing),
      });
    }
  }

  // Quoted at the method being paid with — COD costs more to ship, and that
  // difference has to be in the total the buyer is actually charged.
  const checkout = await computeCheckoutTotals(req.user, { addressId, couponCode, paymentMethod });
  if (checkout.error) {
    return res.status(checkout.error.status).json(serializeCheckoutError(checkout.error));
  }
  const { address, items, subtotal, shipping, discountAmount, normalizedCouponCode, total, couponCartItems, isNewCustomer } = checkout;

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

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
      subtotal,
      discountAmount,
      couponCode: normalizedCouponCode,
      shippingFee: shipping,
      total,
      paymentMethod,
      paymentStatus,
      razorpayOrderId: paymentMethod === 'RAZORPAY' ? razorpayOrderId : null,
      razorpayPaymentId: paymentMethod === 'RAZORPAY' ? razorpayPaymentId : null,
      idempotencyKey,
      b2b: b2b && b2b.isB2B
        ? {
            isB2B: true,
            companyName: typeof b2b.companyName === 'string' ? b2b.companyName.trim() : '',
            gstin: typeof b2b.gstin === 'string' ? b2b.gstin.trim().toUpperCase() : '',
          }
        : {
            isB2B: false,
            companyName: '',
            gstin: '',
          },
      status: 'PENDING',
    });
  } catch (err) {
    await releaseStock(items);
    if (paymentMethod === 'WALLET') {
      await Customer.updateOne({ _id: req.user._id }, { $inc: { walletBalance: total } });
    }
    if (err.code === 11000) {
      // Lost the race against a concurrent identical submission (a double
      // tap, or the same request retried after a timeout). Everything this
      // call reserved has just been released above, and the winner's order is
      // already committed — hand that one back so the buyer sees one order,
      // not an error.
      if (idempotencyKey) {
        const winner = await Order.findOne({ user: req.user._id, idempotencyKey });
        if (winner) {
          return res.status(200).json({
            success: true,
            message: 'Order already placed',
            data: serializeOrder(winner),
          });
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
    message: `Your order for ${items.length} item(s) worth ₹${total.toLocaleString('en-IN')} has been placed successfully.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  await notifyVendorsOfNewOrder(items, order._id);

  // CJ Dropshipping auto-fulfillment & order tracking:
  // If any line in the order is backed by a CJ product, create the CjOrder
  // row and dispatch the order to CJ's system. Wrapped so external network
  // failure never rejects a customer's placed order.
  await processCjOrderFulfillment(order, items);

  // A prepaid order's money is in hand right now, so its sale, commission and
  // gateway fee post immediately. A COD order posts nothing yet — the cash is
  // still with the courier until an admin records the remittance (task §12).
  await postAccounting('order sale', () => accounting.postOrderSale(order.toObject()));

  res.status(201).json({ success: true, message: 'Order placed successfully', data: serializeOrder(order) });
}

async function processCjOrderFulfillment(order, items) {
  try {
    const cjItems = [];
    for (const item of items) {
      const productId = item.product || item.productId;
      const mapping = await ProductFulfillmentMapping.findOne({ product: productId, provider: 'CJ' });
      if (mapping) {
        const vMapping =
          mapping.variants?.find((v) => String(v.krozendaVariantId) === String(item.variantId)) ||
          mapping.variants?.[0];
        cjItems.push({
          product: productId,
          cjProductId: mapping.cjProductId,
          cjVariantId: vMapping?.cjVariantId || mapping.cjProductId,
          quantity: item.quantity,
          unitCost: vMapping?.providerCost || 0,
        });
      }
    }

    if (cjItems.length > 0) {
      await cjOrderService.createOrder({
        krozendaOrderId: order._id,
        krozendaSubOrderId: `CJ-${order._id.toString()}`,
        items: cjItems,
        shippingAddress: {
          countryCode: 'IN',
          country: order.shippingAddress?.country || 'India',
          province: order.shippingAddress?.state || '',
          city: order.shippingAddress?.city || '',
          line: [order.shippingAddress?.line1, order.shippingAddress?.line2].filter(Boolean).join(', '),
          name: order.shippingAddress?.fullName || '',
          zip: order.shippingAddress?.pincode || '',
          phone: order.shippingAddress?.phone || '',
          fromCountryCode: 'CN',
          logisticName: 'CJPacket Eub',
        },
      });
    }
  } catch (err) {
    console.error('CJ Dropshipping order creation notice:', err.message);
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

  const order = await Order.findOneAndUpdate(
    { _id: id, user: req.user._id, status: { $in: USER_CANCELLABLE_STATUSES } },
    { $set: { status: 'CANCELLED', cancelledBy: 'buyer' }, $push: { statusHistory: { status: 'CANCELLED', at: new Date() } } },
    { new: false }
  );

  if (!order) {
    const exists = await Order.exists({ _id: id, user: req.user._id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? 'This order can no longer be cancelled' : 'Order not found',
    });
  }

  await releaseStock(order.items);

  if (order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD') {
    const refundedCustomer = await Customer.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { walletBalance: order.total } },
      { new: true }
    );
    await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: order.total,
      balanceAfter: refundedCustomer.walletBalance,
      source: 'ORDER_REFUND',
      orderId: order._id,
      status: 'SUCCESS',
    });
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });

    // Reverse whatever was posted for this order. The original SALE rows stay
    // exactly as they were — this writes REFUND debits against them and hands
    // the commission back (task §15 Rules 1 and 3).
    await postAccounting('cancellation refund', () =>
      accounting.postOrderCancellationRefund({ order: { ...order.toObject(), paymentStatus: 'REFUNDED' } })
    );
  }

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

  // Wallet is prepaid money, so it ships at the prepaid rate.
  const byMethod = { RAZORPAY: prepaidView, WALLET: prepaidView, COD: codView };
  const chosen = byMethod[selected] || prepaidView;

  res.json({
    success: true,
    message: 'Shipping quote',
    data: {
      paymentMethod: selected,
      subtotal: prepaid.subtotal,
      discountAmount: prepaid.discountAmount,

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

  for (const item of order.items) {
    const product = await Product.findOne({ _id: item.product, isActive: true });
    if (!product) {
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
  cancelOrder,
  getOrderTracking,
  reorder,
  serializeOrder,
  releaseStock,
  reserveStock,
  notifyVendorsOfNewOrder,
};

