const mongoose = require('mongoose');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const ReturnRequest = require('../Models/ReturnRequest');
const { nextIds } = require('./accountingSequence');
const { loadRules, resolveForLine } = require('./commissionResolver');
const { toPaise, percentOfPaise, allocateProportional } = require('../utils/money');
const { lineDiscountsPaise, findLineIndex } = require('../utils/orderLines');

// THE POSTING ENGINE. Every row on the ledger is written by one of the
// functions here, and every one of them is safe to call again: rows carry a
// deterministic `eventKey` with a unique index behind it, so a retried
// webhook, a double-clicked button and the read-time reconciler all converge
// on exactly one row per real-world event (task §15 Rules 4 and 5).
//
// Sign convention, from the SELLER's point of view:
//   CREDIT  the platform owes this seller more  (SALE, REFUND_REVERSAL, +ADJUSTMENT)
//   DEBIT   the platform owes this seller less  (COMMISSION, REFUND, PAYOUT, fees)
//
// Rows with `vendor: null` are the PLATFORM's own side of the transaction —
// the commission it earned is a seller DEBIT, but a gateway fee the platform
// absorbs belongs to nobody's payable and must not quietly reduce a seller's
// money. Those rows still appear in Transactions and in the platform revenue
// figures; they are simply absent from every seller ledger.

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Insert rows, skipping any whose event has already been posted.
 *
 * Two layers of protection, deliberately: the pre-read below keeps the common
 * "already posted" case cheap, and the unique index on `eventKey` is what
 * actually guarantees correctness when two requests race past that read at
 * the same time. A duplicate-key error from the race is the system working,
 * not a failure, so it is counted and swallowed.
 */
async function insertRows(rows, { session } = {}) {
  if (rows.length === 0) return { inserted: [], skipped: 0 };

  const keys = rows.map((row) => row.eventKey);
  const existing = await AccountingTransaction.find({ eventKey: { $in: keys } })
    .select('eventKey')
    .lean();
  const posted = new Set(existing.map((row) => row.eventKey));

  const pending = rows.filter((row) => !posted.has(row.eventKey));
  if (pending.length === 0) return { inserted: [], skipped: rows.length };

  const ids = await nextIds('transaction', pending.length);
  const documents = pending.map((row, index) => ({
    ...row,
    transactionId: ids[index],
    amount: row.credit + row.debit,
  }));

  try {
    const inserted = await AccountingTransaction.insertMany(documents, {
      ordered: false,
      ...(session ? { session } : {}),
    });
    return { inserted, skipped: rows.length - pending.length };
  } catch (err) {
    // ordered:false means the non-duplicate rows were still written. Anything
    // that failed on the unique index was a concurrent double-post of the
    // same event, which is precisely what the index is there to stop.
    if (err.code === 11000 || err.writeErrors) {
      const duplicates = (err.writeErrors || []).filter((e) => e.code === 11000 || e.err?.code === 11000);
      if (duplicates.length === (err.writeErrors || []).length) {
        return { inserted: err.insertedDocs || [], skipped: rows.length - pending.length + duplicates.length };
      }
    }
    throw err;
  }
}

function row({
  type,
  direction,
  amountPaise,
  order = null,
  product = null,
  vendor = null,
  customer = null,
  settlement = null,
  payout = null,
  returnRequest = null,
  paymentReference = null,
  status = 'COMPLETED',
  referenceType = 'ORDER',
  referenceId = null,
  reversalOf = null,
  description = '',
  metadata = {},
  eventKey,
  createdBy = null,
}) {
  const amount = Math.round(amountPaise);
  return {
    type,
    direction,
    credit: direction === 'CREDIT' ? amount : 0,
    debit: direction === 'DEBIT' ? amount : 0,
    order,
    product,
    vendor,
    customer,
    settlement,
    payout,
    returnRequest,
    paymentReference,
    status,
    referenceType,
    referenceId: referenceId === null ? null : String(referenceId),
    reversalOf,
    description,
    metadata,
    eventKey,
    createdBy,
  };
}

// ---------------------------------------------------------------------------
// Order -> ledger
// ---------------------------------------------------------------------------

// An order line, in paise, with the order-level discount and shipping already
// attributed to it. Splitting this out keeps the sale, refund and settlement
// paths reading the SAME arithmetic — a refund that computed a line's value
// differently from the sale that created it is how ledgers stop balancing.
//
// `discountAmount` and `shippingFee` are order-level on this platform (see
// Models/Order.js), so both are apportioned across the lines by line value
// using the exact largest-remainder split in utils/money.js. The parts add
// back up to the order total to the paise, which is what makes a multi-seller
// order split cleanly (task §23).
function explodeOrderLines(order, { couponFundedByVendor }) {
  const lines = order.items.map((item, index) => ({
    index,
    product: item.product,
    vendor: item.vendor || null,
    name: item.name,
    quantity: item.quantity,
    status: item.status,
    grossPaise: toPaise(item.price) * item.quantity,
  }));

  const weights = lines.map((line) => line.grossPaise);
  // Each line's own coupon share, fixed at checkout over only the lines the
  // coupon applied to. Spreading the order-level figure over EVERY line made
  // one seller pay for another seller's coupon; older orders without the
  // snapshot still fall back to that spread (see utils/orderLines).
  const discountShares = lineDiscountsPaise(order);
  const shippingShares = allocateProportional(toPaise(order.shippingFee), weights);

  return lines.map((line, index) => {
    const discountPaise = discountShares[index];
    const shippingPaise = shippingShares[index];

    // Who paid for the discount decides whose money it comes out of. A
    // seller's own coupon (Coupon.vendorId set — see vendorCouponController)
    // reduces what that seller earns; an admin coupon is a platform promotion
    // and the seller is still owed the full line (task §24).
    const sellerFundedDiscountPaise = couponFundedByVendor ? discountPaise : 0;
    const platformFundedDiscountPaise = couponFundedByVendor ? 0 : discountPaise;

    return {
      ...line,
      discountPaise,
      shippingPaise,
      sellerFundedDiscountPaise,
      platformFundedDiscountPaise,
      // What the seller is entitled to for this line.
      sellerGrossPaise: line.grossPaise - sellerFundedDiscountPaise,
      // What the buyer actually paid towards this line, shipping aside.
      buyerPaidPaise: line.grossPaise - discountPaise,
    };
  });
}

function commissionBaseFor(line, config) {
  if (config.commissionBase === 'LINE_GROSS') return line.grossPaise;
  if (config.commissionBase === 'LINE_NET') return line.grossPaise - line.discountPaise;
  return line.sellerGrossPaise; // LINE_NET_OF_SELLER_FUNDED_DISCOUNT
}

// Did the buyer's money actually reach the platform? Prepaid orders are paid
// at checkout; a COD order is not "received" until the courier remits it,
// which is an explicit admin action (task §12).
function isMoneyReceived(order) {
  if (order.paymentMethod === 'COD') return Boolean(order.codRemittedAt);
  return order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED';
}

/**
 * Post SALE / COMMISSION / gateway fee / shipping for one order.
 *
 * Runs only once the money has actually been received, and is a no-op on
 * every call after the first. Returns a summary rather than throwing when
 * there is nothing to do, so callers can treat it as fire-and-forget.
 */
async function postOrderSale(orderInput, { session, createdBy = null } = {}) {
  const order =
    orderInput && orderInput.items
      ? orderInput
      : await Order.findById(orderInput).lean();

  if (!order) return { posted: 0, reason: 'order-not-found' };
  if (!isMoneyReceived(order)) return { posted: 0, reason: 'payment-not-received' };

  const config = await AccountingConfig.resolve();

  // Seller-funded vs platform-funded discount (see explodeOrderLines).
  let couponFundedByVendor = false;
  if (order.couponCode) {
    const coupon = await Coupon.findOne({ code: order.couponCode }).select('vendorId').lean();
    couponFundedByVendor = Boolean(coupon?.vendorId);
  }

  const lines = explodeOrderLines(order, { couponFundedByVendor });
  const sellerLines = lines.filter((line) => line.vendor);

  const vendorIds = [...new Set(sellerLines.map((line) => String(line.vendor)))];
  const productIds = [...new Set(lines.map((line) => String(line.product)))];

  const [vendors, products] = await Promise.all([
    Vendor.find({ _id: { $in: vendorIds } }).select('commissionRatePercent name business.businessName').lean(),
    Product.find({ _id: { $in: productIds } }).select('category').lean(),
  ]);
  const vendorRate = new Map(vendors.map((v) => [String(v._id), v.commissionRatePercent]));
  const productCategory = new Map(products.map((p) => [String(p._id), p.category ? String(p.category) : null]));

  // Rules are resolved as of when the ORDER was paid, not as of now, so a
  // rule written today can never restate what an old order was charged
  // (task §6, §15 Rule 6).
  const appliedAt = order.codRemittedAt || order.createdAt || new Date();
  const rules = await loadRules({
    vendorIds,
    categoryIds: [...new Set([...productCategory.values()].filter(Boolean))],
    productIds,
    at: new Date(appliedAt),
  });

  const rows = [];
  const orderRef = order._id;
  const orderLabel = String(order._id).slice(-8).toUpperCase();

  for (const line of sellerLines) {
    const base = `${orderRef}:${line.index}:${line.product}`;

    rows.push(
      row({
        type: 'SALE',
        direction: 'CREDIT',
        amountPaise: line.sellerGrossPaise,
        order: orderRef,
        product: line.product,
        vendor: line.vendor,
        customer: order.user,
        paymentReference: order.razorpayPaymentId || null,
        referenceType: 'ORDER_ITEM',
        referenceId: line.product,
        description: `Sale — ${line.name} (order ${orderLabel})`,
        metadata: {
          orderNumber: orderLabel,
          quantity: line.quantity,
          unitPricePaise: toPaise(order.items[line.index].price),
          lineGrossPaise: line.grossPaise,
          discountPaise: line.discountPaise,
          sellerFundedDiscountPaise: line.sellerFundedDiscountPaise,
          platformFundedDiscountPaise: line.platformFundedDiscountPaise,
          shippingPaise: line.shippingPaise,
          buyerPaidPaise: line.buyerPaidPaise,
          paymentMethod: order.paymentMethod,
        },
        eventKey: `SALE:${base}`,
        createdBy,
      })
    );

    const commission = resolveForLine(
      {
        basePaise: commissionBaseFor(line, config),
        vendorId: line.vendor,
        categoryId: productCategory.get(String(line.product)),
        productId: line.product,
        vendorRatePercent: vendorRate.get(String(line.vendor)),
      },
      rules,
      config
    );

    if (commission.amountPaise > 0) {
      rows.push(
        row({
          type: 'COMMISSION',
          direction: 'DEBIT',
          amountPaise: commission.amountPaise,
          order: orderRef,
          product: line.product,
          vendor: line.vendor,
          customer: order.user,
          referenceType: 'ORDER_ITEM',
          referenceId: line.product,
          description: `Platform commission — ${line.name} (order ${orderLabel})`,
          // The rate and the rule that produced it are frozen here. This is
          // the record the Commissions report reads, so changing the rule
          // later cannot restate it.
          metadata: {
            orderNumber: orderLabel,
            commissionBase: config.commissionBase,
            ...commission.workings,
            source: commission.source,
            ratePercent: commission.ratePercent,
          },
          eventKey: `COMMISSION:${base}`,
          createdBy,
        })
      );
    }

    if (config.shippingRevenueBearer === 'SELLER' && line.shippingPaise > 0) {
      rows.push(
        row({
          type: 'SHIPPING_CHARGE',
          direction: 'CREDIT',
          amountPaise: line.shippingPaise,
          order: orderRef,
          product: line.product,
          vendor: line.vendor,
          customer: order.user,
          referenceType: 'ORDER_ITEM',
          referenceId: line.product,
          description: `Shipping collected — order ${orderLabel}`,
          metadata: { orderNumber: orderLabel, bearer: 'SELLER' },
          eventKey: `SHIPPING:${base}`,
          createdBy,
        })
      );
    }
  }

  // --- order-level rows --------------------------------------------------
  const orderTotalPaise = toPaise(order.total);

  // Gateway fee applies to online captures only — COD and wallet payments
  // never touch a payment gateway (task §11).
  if (order.paymentMethod === 'RAZORPAY' && orderTotalPaise > 0) {
    // The gateway's fixed fee is charged once per PAYMENT. A split checkout
    // pays two orders with one payment, so only its primary order carries it.
    const fixedFeePaise = (order.checkoutGroupIndex || 0) === 0 ? toPaise(config.gatewayFeeFixed) : 0;
    const feePaise = percentOfPaise(orderTotalPaise, config.gatewayFeePercent) + fixedFeePaise;

    if (feePaise > 0) {
      if (config.gatewayFeeBearer === 'SELLER' && sellerLines.length > 0) {
        // Charged on, split across the sellers by what each line contributed
        // to the amount that was actually captured.
        const shares = allocateProportional(feePaise, sellerLines.map((line) => line.buyerPaidPaise));
        sellerLines.forEach((line, index) => {
          if (shares[index] <= 0) return;
          rows.push(
            row({
              type: 'PAYMENT_GATEWAY_FEE',
              direction: 'DEBIT',
              amountPaise: shares[index],
              order: orderRef,
              product: line.product,
              vendor: line.vendor,
              customer: order.user,
              paymentReference: order.razorpayPaymentId || null,
              referenceType: 'ORDER_ITEM',
              referenceId: line.product,
              description: `Payment gateway fee — order ${orderLabel}`,
              metadata: {
                orderNumber: orderLabel,
                bearer: 'SELLER',
                gatewayFeePercent: config.gatewayFeePercent,
                gatewayFeeFixedPaise: toPaise(config.gatewayFeeFixed),
                orderFeePaise: feePaise,
              },
              eventKey: `GATEWAY_FEE:${orderRef}:${line.index}:${line.product}`,
              createdBy,
            })
          );
        });
      } else {
        // The platform absorbs it: a cost of running the marketplace, and no
        // seller's payable moves because of it.
        rows.push(
          row({
            type: 'PAYMENT_GATEWAY_FEE',
            direction: 'DEBIT',
            amountPaise: feePaise,
            order: orderRef,
            vendor: null,
            customer: order.user,
            paymentReference: order.razorpayPaymentId || null,
            referenceType: 'ORDER',
            referenceId: orderRef,
            description: `Payment gateway fee — order ${orderLabel}`,
            metadata: {
              orderNumber: orderLabel,
              bearer: 'PLATFORM',
              gatewayFeePercent: config.gatewayFeePercent,
              gatewayFeeFixedPaise: toPaise(config.gatewayFeeFixed),
            },
            eventKey: `GATEWAY_FEE:${orderRef}`,
            createdBy,
          })
        );
      }
    }
  }

  // Shipping the platform keeps.
  if (config.shippingRevenueBearer === 'PLATFORM' && toPaise(order.shippingFee) > 0) {
    rows.push(
      row({
        type: 'SHIPPING_CHARGE',
        direction: 'CREDIT',
        amountPaise: toPaise(order.shippingFee),
        order: orderRef,
        vendor: null,
        customer: order.user,
        referenceType: 'ORDER',
        referenceId: orderRef,
        description: `Shipping collected — order ${orderLabel}`,
        metadata: { orderNumber: orderLabel, bearer: 'PLATFORM' },
        eventKey: `SHIPPING:${orderRef}`,
        createdBy,
      })
    );
  }

  const result = await insertRows(rows, { session });
  return { posted: result.inserted.length, skipped: result.skipped };
}

// ---------------------------------------------------------------------------
// COD collection (task §12)
// ---------------------------------------------------------------------------

/**
 * Record that the courier has remitted the cash for a delivered COD order,
 * and only then post its sale to the ledger.
 *
 * The status guard on the update is what makes this idempotent: the second
 * caller finds no document matching `codRemittedAt: null` and is told the
 * money is already in, rather than posting a second set of rows.
 */
async function recordCodRemittance({ orderId, reference = '', createdBy = null }) {
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, status: 400, message: 'Invalid order id' };
  }

  const order = await Order.findById(orderId).lean();
  if (!order) return { ok: false, status: 404, message: 'Order not found' };
  if (order.paymentMethod !== 'COD') {
    return { ok: false, status: 400, message: 'Only COD orders are remitted by the courier' };
  }
  if (order.status !== 'DELIVERED') {
    return { ok: false, status: 400, message: 'COD can only be collected once the order has been delivered' };
  }
  if (order.codRemittedAt) {
    return { ok: false, status: 409, message: 'This COD order has already been remitted' };
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentMethod: 'COD', status: 'DELIVERED', codRemittedAt: null },
    { $set: { codRemittedAt: new Date(), codRemittanceReference: String(reference || '').trim(), paymentStatus: 'PAID' } },
    { new: true }
  ).lean();

  if (!updated) {
    return { ok: false, status: 409, message: 'This COD order has already been remitted' };
  }

  const posted = await postOrderSale(updated, { createdBy });
  return { ok: true, order: updated, posted };
}

// ---------------------------------------------------------------------------
// Refunds (task §9, §15 Rule 3)
// ---------------------------------------------------------------------------

// A refund NEVER edits or deletes the SALE it claws back. It posts a REFUND
// debit against the seller for the money going back to the buyer, and a
// REFUND_REVERSAL credit returning the commission that was charged on the
// part being refunded — so the seller is not left paying commission on a sale
// that did not stand.
//
// Both are proportional to the amount actually refunded, which is what makes
// partial refunds and repeated partial refunds add up correctly.
function refundRowsForLine({ saleRow, commissionRow, refundPaise, order, returnRequestId, reasonLabel, createdBy, keySuffix }) {
  const rows = [];
  const orderLabel = String(order._id).slice(-8).toUpperCase();
  const capped = Math.min(refundPaise, saleRow.credit);
  if (capped <= 0) return rows;

  rows.push(
    row({
      type: 'REFUND',
      direction: 'DEBIT',
      amountPaise: capped,
      order: order._id,
      product: saleRow.product,
      vendor: saleRow.vendor,
      customer: order.user,
      returnRequest: returnRequestId || null,
      reversalOf: saleRow._id,
      referenceType: returnRequestId ? 'RETURN_REQUEST' : 'ORDER',
      referenceId: returnRequestId || order._id,
      description: `Refund — ${reasonLabel} (order ${orderLabel})`,
      metadata: {
        orderNumber: orderLabel,
        reversedTransactionId: saleRow.transactionId,
        originalSalePaise: saleRow.credit,
        isPartial: capped < saleRow.credit,
      },
      eventKey: `REFUND:${keySuffix}`,
      createdBy,
    })
  );

  // Give back commission in the same proportion as the refund.
  if (commissionRow && commissionRow.debit > 0 && saleRow.credit > 0) {
    const commissionBack = Math.round((commissionRow.debit * capped) / saleRow.credit);
    if (commissionBack > 0) {
      rows.push(
        row({
          type: 'REFUND_REVERSAL',
          direction: 'CREDIT',
          amountPaise: commissionBack,
          order: order._id,
          product: saleRow.product,
          vendor: saleRow.vendor,
          customer: order.user,
          returnRequest: returnRequestId || null,
          reversalOf: commissionRow._id,
          referenceType: returnRequestId ? 'RETURN_REQUEST' : 'ORDER',
          referenceId: returnRequestId || order._id,
          description: `Commission reversed on refund — order ${orderLabel}`,
          metadata: {
            orderNumber: orderLabel,
            reversedTransactionId: commissionRow.transactionId,
            originalCommissionPaise: commissionRow.debit,
            refundedPortionPaise: capped,
          },
          eventKey: `REFUND_REVERSAL:${keySuffix}`,
          createdBy,
        })
      );
    }
  }

  return rows;
}

// The posted SALE and COMMISSION for one order, indexed by ORDER LINE, so a
// refund can find exactly what it is reversing.
//
// Keyed by line, not product: two variants of one product are two lines with
// two sale rows, and a product-keyed map kept only the last of them — so a
// cancellation reversed one variant's sale and silently left the other. The
// line index is read from the row's eventKey (`SALE:<order>:<index>:<product>`),
// which every sale and commission row has carried since they were introduced.
function lineKeyOf(entry) {
  const parts = String(entry.eventKey || '').split(':');
  return parts.length >= 4 && /^\d+$/.test(parts[2]) ? parts[2] : `product:${entry.product}`;
}

async function postedRowsByLine(orderId) {
  const posted = await AccountingTransaction.find({
    order: orderId,
    type: { $in: ['SALE', 'COMMISSION'] },
  }).lean();

  const sales = new Map();
  const commissions = new Map();
  for (const entry of posted) {
    const key = lineKeyOf(entry);
    if (entry.type === 'SALE') sales.set(key, entry);
    else commissions.set(key, entry);
  }
  return { sales, commissions };
}

// What has already been refunded against each sale row, by that row's id.
async function refundedBySaleRow(orderId) {
  const refunded = await AccountingTransaction.aggregate([
    { $match: { order: new mongoose.Types.ObjectId(String(orderId)), type: 'REFUND' } },
    { $group: { _id: '$reversalOf', total: { $sum: '$debit' } } },
  ]);
  return new Map(refunded.map((entry) => [String(entry._id), entry.total]));
}

/**
 * Post the accounting impact of an APPROVED refund request (one order line).
 * Idempotent on the return request's id.
 */
async function postReturnRefund({ returnRequest, createdBy = null }) {
  const request =
    returnRequest.refundAmount !== undefined
      ? returnRequest
      : await ReturnRequest.findById(returnRequest).lean();
  if (!request) return { posted: 0, reason: 'return-not-found' };

  const order = await Order.findById(request.order).lean();
  if (!order) return { posted: 0, reason: 'order-not-found' };

  const { sales, commissions } = await postedRowsByLine(order._id);
  // The request names its line by product + variant. A request from before
  // variants were recorded on it falls back to the product's first line.
  const index = findLineIndex(order, request.product, request.variantId);
  const fallbackIndex = order.items.findIndex((item) => String(item.product) === String(request.product));
  const lineKey = String(index >= 0 ? index : fallbackIndex);
  const saleRow = sales.get(lineKey) || sales.get(`product:${request.product}`);
  // Nothing was ever posted for this line — an unremitted COD order, say.
  // There is no sale to claw back, so there is nothing to reverse either.
  if (!saleRow) return { posted: 0, reason: 'no-sale-posted' };

  const rows = refundRowsForLine({
    saleRow,
    commissionRow: commissions.get(lineKey) || commissions.get(`product:${request.product}`),
    refundPaise: toPaise(request.refundAmount || 0),
    order,
    returnRequestId: request._id,
    reasonLabel: request.reason || 'return approved',
    createdBy,
    keySuffix: `RETURN:${request._id}`,
  });

  const result = await insertRows(rows);
  return { posted: result.inserted.length, skipped: result.skipped };
}

/**
 * Post the accounting impact of a whole order being cancelled and refunded
 * after its sale had already been posted. Every seller line on the order is
 * reversed in full.
 */
async function postOrderCancellationRefund({ order: orderInput, createdBy = null }) {
  const order = orderInput && orderInput.items ? orderInput : await Order.findById(orderInput).lean();
  if (!order) return { posted: 0, reason: 'order-not-found' };

  const { sales, commissions } = await postedRowsByLine(order._id);
  if (sales.size === 0) return { posted: 0, reason: 'no-sale-posted' };

  // Anything already refunded through a return request is netted off, so a
  // cancellation after a partial refund cannot pay the same money back twice.
  // Netted per sale row, so it holds for two variants of one product too.
  const refunded = await refundedBySaleRow(order._id);
  const salesPerProduct = new Map();
  for (const saleRow of sales.values()) {
    const product = String(saleRow.product);
    salesPerProduct.set(product, (salesPerProduct.get(product) || 0) + 1);
  }

  const rows = [];
  for (const [lineKey, saleRow] of sales) {
    const outstanding = saleRow.credit - (refunded.get(String(saleRow._id)) || 0);
    if (outstanding <= 0) continue;

    const productKey = String(saleRow.product);
    rows.push(
      ...refundRowsForLine({
        saleRow,
        commissionRow: commissions.get(lineKey),
        refundPaise: outstanding,
        order,
        returnRequestId: null,
        reasonLabel: 'order cancelled',
        createdBy,
        // Unchanged key shape for a product with one line, so a cancellation
        // posted before this change is recognised rather than posted again.
        keySuffix:
          salesPerProduct.get(productKey) > 1
            ? `ORDER_CANCEL:${order._id}:${productKey}:${lineKey}`
            : `ORDER_CANCEL:${order._id}:${productKey}`,
      })
    );
  }

  const result = await insertRows(rows);
  return { posted: result.inserted.length, skipped: result.skipped };
}

/**
 * Reverse the sale for ONE order line that was cancelled on its own (a seller
 * rejecting it, or an admin cancelling a sub-order) after the order's sale was
 * posted. Idempotent on (order, line).
 */
async function postLineCancellationRefund({ order: orderInput, lineIndex, createdBy = null }) {
  const order = orderInput && orderInput.items ? orderInput : await Order.findById(orderInput).lean();
  if (!order) return { posted: 0, reason: 'order-not-found' };

  const { sales, commissions } = await postedRowsByLine(order._id);
  const saleRow = sales.get(String(lineIndex));
  // Nothing posted for this line yet (an unremitted COD order): nothing to reverse.
  if (!saleRow) return { posted: 0, reason: 'no-sale-posted' };

  const refunded = await refundedBySaleRow(order._id);
  const outstanding = saleRow.credit - (refunded.get(String(saleRow._id)) || 0);
  if (outstanding <= 0) return { posted: 0, reason: 'already-refunded' };

  const rows = refundRowsForLine({
    saleRow,
    commissionRow: commissions.get(String(lineIndex)),
    refundPaise: outstanding,
    order,
    returnRequestId: null,
    reasonLabel: 'item cancelled',
    createdBy,
    keySuffix: `LINE_CANCEL:${order._id}:${lineIndex}`,
  });

  const result = await insertRows(rows);
  return { posted: result.inserted.length, skipped: result.skipped };
}

// ---------------------------------------------------------------------------
// Manual adjustment (task §19)
// ---------------------------------------------------------------------------

/**
 * A deliberate correction to a seller's balance — shipping compensation, a
 * penalty, a negotiated write-off. Always a ledger row: there is no path
 * anywhere in this module that moves a seller's balance without one.
 */
async function postAdjustment({ vendorId, amountPaise, direction, reason, orderId = null, createdBy = null }) {
  const amount = Math.round(Number(amountPaise));
  if (!mongoose.isValidObjectId(vendorId)) return { ok: false, status: 400, message: 'Select a valid seller' };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, status: 400, message: 'Enter an amount greater than zero' };
  if (!['CREDIT', 'DEBIT'].includes(direction)) return { ok: false, status: 400, message: 'Select credit or debit' };
  if (!reason || !String(reason).trim()) return { ok: false, status: 400, message: 'A reason is required' };

  const vendor = await Vendor.findById(vendorId).select('name business.businessName').lean();
  if (!vendor) return { ok: false, status: 404, message: 'Seller not found' };

  if (orderId && !mongoose.isValidObjectId(orderId)) {
    return { ok: false, status: 400, message: 'Invalid order id' };
  }
  if (orderId) {
    // A seller-scoped adjustment must not be filed against another seller's
    // order (task §15 Rule 10).
    const owns = await Order.exists({ _id: orderId, 'items.vendor': vendorId });
    if (!owns) return { ok: false, status: 400, message: 'That order does not belong to this seller' };
  }

  // Manual adjustments are genuinely distinct events, so the key carries a
  // fresh id rather than trying to deduplicate two intentional corrections
  // that happen to look alike.
  const eventKey = `ADJUSTMENT:${new mongoose.Types.ObjectId()}`;

  const result = await insertRows([
    row({
      type: 'ADJUSTMENT',
      direction,
      amountPaise: amount,
      order: orderId || null,
      vendor: vendorId,
      referenceType: 'MANUAL',
      referenceId: null,
      description: String(reason).trim(),
      metadata: { seller: vendor.business?.businessName || vendor.name, manual: true },
      eventKey,
      createdBy,
    }),
  ]);

  return { ok: true, transaction: result.inserted[0] };
}

// ---------------------------------------------------------------------------
// Read-time reconciler
// ---------------------------------------------------------------------------

/**
 * Post anything an inline hook missed.
 *
 * The hooks in the order/refund controllers post immediately so the ledger is
 * current the moment money moves, but they are deliberately non-fatal — an
 * accounting failure must never fail a customer's checkout. This is the other
 * half of that bargain: the Accounting screens call it on read, so a row that
 * failed to post inline is picked up on the next look rather than silently
 * missing forever. Everything it does is idempotent, so running it on every
 * read costs a few queries and changes nothing once the ledger is complete.
 */
async function reconcileLedger({ limit = 200 } = {}) {
  const summary = { sales: 0, refunds: 0, cancellations: 0 };

  // 1. Paid orders with no SALE row yet.
  const postedOrderIds = await AccountingTransaction.distinct('order', { type: 'SALE' });
  const unposted = await Order.find({
    _id: { $nin: postedOrderIds },
    $or: [
      { paymentMethod: { $ne: 'COD' }, paymentStatus: { $in: ['PAID', 'REFUNDED'] } },
      { paymentMethod: 'COD', codRemittedAt: { $ne: null } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  for (const order of unposted) {
    const result = await postOrderSale(order);
    summary.sales += result.posted;
  }

  // 2. Approved refunds with no REFUND row yet.
  const refundedIds = await AccountingTransaction.distinct('returnRequest', { type: 'REFUND' });
  const approvedRefunds = await ReturnRequest.find({
    requestType: 'REFUND',
    status: 'APPROVED',
    _id: { $nin: refundedIds.filter(Boolean) },
  })
    .limit(limit)
    .lean();

  for (const request of approvedRefunds) {
    const result = await postReturnRefund({ returnRequest: request });
    summary.refunds += result.posted;
  }

  // 3. Cancelled-and-refunded orders whose posted sale was never reversed.
  const cancelled = await Order.find({
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    _id: { $in: postedOrderIds },
  })
    .limit(limit)
    .lean();

  for (const order of cancelled) {
    const result = await postOrderCancellationRefund({ order });
    summary.cancellations += result.posted;
  }

  return summary;
}

module.exports = {
  insertRows,
  row,
  explodeOrderLines,
  commissionBaseFor,
  isMoneyReceived,
  postOrderSale,
  recordCodRemittance,
  postReturnRefund,
  postOrderCancellationRefund,
  postLineCancellationRefund,
  postAdjustment,
  reconcileLedger,
};
