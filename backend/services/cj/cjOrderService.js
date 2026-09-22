const crypto = require('crypto');
const CjOrder = require('../../Models/CjOrder');
const { call } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');
const { mapCjStatus } = require('./cjStatusMapper');

// Phase 5 — CJ order creation, the highest-stakes surface in this whole
// integration (master plan §31, "Idempotency"). NOTE: CJ's exact request/
// response field names for order creation should be confirmed against the
// live CJ API 2.0 "Shopping" reference before this goes to production —
// the shapes below follow CJ's documented conventions but this file has not
// been run against a real CJ sandbox account. The idempotency architecture
// (which is the part that actually protects money) does not depend on
// getting every field name right on the first try.

const CREATE_ORDER_PATH = '/v1/shopping/order/createOrder';
const ORDER_DETAIL_PATH = '/v1/shopping/order/getOrderDetail';
const CANCEL_ORDER_PATH = '/v1/shopping/order/deleteOrder';

function authenticatedCall(request) {
  return cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() => call({ ...request, accessToken }))
  );
}

class CjOrderError extends Error {
  constructor(message, { status = 502, code = 'CJ_ORDER_ERROR' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// THE RULE THIS FUNCTION EXISTS TO ENFORCE: never call CJ's create-order
// endpoint twice for the same krozendaSubOrderId.
//
// Flow:
//   1. Look for an existing CjOrder row for this sub-order id.
//   2a. If it already has a cjOrderId, CJ already created it — return as-is,
//       no network call at all (covers retried webhooks/requests).
//   2b. If the row exists but has no cjOrderId, a previous attempt got as far
//       as writing the row but never confirmed success with CJ (e.g. crashed
//       before the response came back, or CJ's response was a timeout with
//       unknown outcome). Re-attempt using the SAME createRequestId so CJ's
//       own idempotency (it dedupes on orderNumber) catches a duplicate.
//   3. Only a genuinely new sub-order id creates a fresh row + fresh CJ call.
async function createOrder({ krozendaOrderId, krozendaSubOrderId, items, shippingAddress, createdBy = null }) {
  if (!krozendaSubOrderId) throw new CjOrderError('krozendaSubOrderId is required', { status: 400 });
  if (!Array.isArray(items) || items.length === 0) {
    throw new CjOrderError('items are required', { status: 400 });
  }

  let cjOrder = await CjOrder.findOne({ krozendaSubOrderId });

  if (cjOrder?.cjOrderId) {
    return cjOrder; // already created — this IS the idempotency short-circuit
  }

  if (!cjOrder) {
    cjOrder = await CjOrder.create({
      krozendaOrderId,
      krozendaSubOrderId,
      items: items.map((i) => ({
        product: i.product,
        cjProductId: i.cjProductId,
        cjVariantId: i.cjVariantId,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
      totalCost: items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0),
      createRequestId: crypto.randomUUID(),
      createdBy,
    });
  }

  // orderNumber is CJ's own idempotency key — sending the SAME value on a
  // retry lets CJ itself reject/return the original order instead of
  // creating a duplicate, even if our own short-circuit above somehow missed it.
  const orderNumber = cjOrder.krozendaSubOrderId;

  try {
    const { body } = await authenticatedCall({
      method: 'POST',
      path: CREATE_ORDER_PATH,
      idempotent: false, // an order-creation POST is NEVER blindly retried by the HTTP layer
      body: {
        orderNumber,
        shippingCountryCode: shippingAddress?.countryCode || 'IN',
        shippingCountry: shippingAddress?.country || 'India',
        shippingProvince: shippingAddress?.province,
        shippingCity: shippingAddress?.city,
        shippingAddress: shippingAddress?.line,
        shippingCustomerName: shippingAddress?.name,
        shippingZip: shippingAddress?.zip,
        shippingPhone: shippingAddress?.phone,
        fromCountryCode: shippingAddress?.fromCountryCode || 'CN',
        logisticName: shippingAddress?.logisticName || 'CJPacket Eub',
        // CJ's payType conventions include a create-only/balance-payment mode
        // (master plan §15) — PAY_BALANCE means "create and pay from CJ
        // account balance immediately"; a create-only flow would use a
        // different value and a separate CJPaymentService call, deferred
        // until Phase 5's payment step is wired to a real CJ balance.
        payType: 'PAY_BALANCE',
        products: items.map((i) => ({ vid: i.cjVariantId, quantity: i.quantity })),
      },
    });

    const data = body?.data;
    const resolvedCjOrderId = typeof data === 'string' ? data : (data?.orderId || data?.cjOrderId || data?.cjOrderCode);
    cjOrder.cjOrderId = resolvedCjOrderId || cjOrder.cjOrderId;
    cjOrder.cjOrderNumber = orderNumber;
    cjOrder.status = 'CONFIRMED';
    cjOrder.lastError = '';
    await cjOrder.save();

    return cjOrder;
  } catch (err) {
    // A timeout means CJ MAY have created the order despite us never seeing
    // the response (master plan §31/§3: "unavoidable provider-side failure").
    // We do not know which, so this is left PENDING_PAYMENT/no cjOrderId
    // rather than marked FULFILLMENT_FAILED — a human (or a reconciliation
    // job querying CJ by orderNumber) must resolve it, exactly like
    // Shiprocket's RECONCILIATION_REQUIRED pattern.
    if (err.isTimeout) {
      cjOrder.lastError = 'Timed out — outcome unknown, needs reconciliation against CJ by orderNumber';
      await cjOrder.save();
      throw new CjOrderError(cjOrder.lastError, { status: 202, code: 'CJ_ORDER_RECONCILIATION_REQUIRED' });
    }

    // Any other failure (validation, stock-out, rejected) is a genuine,
    // known failure — this is the "CJ Fulfillment Failed" state that should
    // trigger the automatic refund workflow once checkout wiring exists.
    cjOrder.status = 'FULFILLMENT_FAILED';
    cjOrder.lastError = err.message;
    await cjOrder.save();
    throw new CjOrderError(err.message, { status: 400, code: 'CJ_ORDER_CREATE_FAILED' });
  }
}

async function refreshOrderStatus(cjOrderId) {
  const cjOrder = await CjOrder.findOne({
    $or: [
      { cjOrderId },
      { cjOrderNumber: cjOrderId },
      { krozendaSubOrderId: cjOrderId },
    ],
  });
  if (!cjOrder) throw new CjOrderError('CJ order not found', { status: 404 });

  const { body } = await authenticatedCall({
    method: 'GET',
    path: ORDER_DETAIL_PATH,
    query: { orderId: cjOrder.cjOrderId || cjOrderId },
    idempotent: true,
  });

  const data = body?.data;
  if (data?.orderStatus) {
    cjOrder.status = mapCjStatus(data.orderStatus);
  }
  if (data?.paymentStatus) {
    cjOrder.paymentStatus = data.paymentStatus === 'PAID' ? 'PAID' : cjOrder.paymentStatus;
  }
  const shippingCost = typeof data?.postageAmount === 'number' ? data.postageAmount : data?.logisticPrice;
  if (typeof shippingCost === 'number') cjOrder.shippingCost = shippingCost;
  if (typeof data?.productAmount === 'number') cjOrder.totalCost = data.productAmount;
  await cjOrder.save();

  // If CJ assigned tracking information, sync CjShipment and parent order
  if (data?.trackNumber) {
    try {
      const CjShipment = require('../../Models/CjShipment');
      const Order = require('../../Models/Order');
      let shipment = await CjShipment.findOne({ cjOrder: cjOrder._id });
      if (!shipment) {
        shipment = new CjShipment({ cjOrder: cjOrder._id, cjOrderId: cjOrder.cjOrderId });
      }
      shipment.trackingNumber = data.trackNumber;
      shipment.carrier = data.logisticName || shipment.carrier;
      shipment.status = cjOrder.status === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED';
      shipment.lastSyncedAt = new Date();
      await shipment.save();

      if (cjOrder.krozendaOrderId) {
        await Order.updateOne(
          { _id: cjOrder.krozendaOrderId },
          {
            $set: {
              'items.$[elem].courierName': data.logisticName || 'CJ Dropshipping',
              'items.$[elem].trackingNumber': data.trackNumber,
              'items.$[elem].status': cjOrder.status === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED',
            },
          },
          { arrayFilters: [{ 'elem.status': { $nin: ['DELIVERED', 'CANCELLED'] } }] }
        );
      }
    } catch (shipErr) {
      console.error('[refreshOrderStatus] tracking sync error:', shipErr.message);
    }
  }

  return cjOrder;
}

// Only meaningful before CJ has moved the order past WAIT_SHIPMENT — CJ
// restricts logistics modification after that point (master plan §20), so
// this can fail with a genuine "not cancellable" business error, which is
// surfaced as-is rather than retried.
async function cancelOrder(cjOrderId) {
  const cjOrder = await CjOrder.findOne({ cjOrderId });
  if (!cjOrder) throw new CjOrderError('CJ order not found', { status: 404 });

  await authenticatedCall({
    method: 'POST',
    path: CANCEL_ORDER_PATH,
    idempotent: false,
    body: { orderId: cjOrderId },
  });

  cjOrder.status = 'CANCELLED';
  await cjOrder.save();
  return cjOrder;
}

module.exports = { createOrder, refreshOrderStatus, cancelOrder, CjOrderError };
