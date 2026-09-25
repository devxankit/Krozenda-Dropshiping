// Buyer-facing moments that the Order-model WhatsApp hook (PLACED ..
// CANCELLED) cannot see, because they are not order status changes: a refund
// actually landing, and the last-mile courier events (out for delivery, a
// failed delivery attempt). Each sends the in-app row + push
// (createNotification) and a WhatsApp, keyed so a replayed webhook or a
// second tracking poll never sends it twice.
//
// Never throws. WhatsApp sends are detached (not awaited) so a webhook or
// tracking poll never waits on the gateway.
const Order = require('../Models/Order');
const { createNotification } = require('../Controllers/notificationController');
const whatsapp = require('./whatsappService');
const links = require('../utils/notificationLinks');

function buyerName(order) {
  return whatsapp.firstName(order?.shippingAddress?.fullName);
}

/**
 * Money is on its way back to the buyer.
 * @param {object} args
 * @param {object} args.order        the order (doc or lean) the refund is for
 * @param {number} args.amount       rupees
 * @param {string} args.destination  'Krozenda wallet' | 'original payment method'
 * @param {string} args.key          unique per refund (refund id / request id)
 */
async function notifyRefundProcessed({ order, amount, destination, key }) {
  try {
    const orderNumber = whatsapp.orderNumber(order._id);
    const toWallet = /wallet/i.test(destination);

    // The wallet path already told the buyer in-app (refundService's "Refund
    // Approved"), so only the Razorpay path adds a row here.
    if (!toWallet) {
      await createNotification({
        userId: order.user,
        type: 'WALLET',
        title: 'Refund processed',
        message: `₹${Number(amount).toLocaleString('en-IN')} for order ${orderNumber} has been refunded to your ${destination}. It can take 5-7 working days to show up.`,
        actionType: 'ORDER',
        actionRefId: order._id,
      });
    }

    whatsapp.sendTemplateOnce({
      key: `REFUND:${key}`,
      template: 'REFUND_PROCESSED',
      phone: order.shippingAddress?.phone,
      params: [
        buyerName(order),
        orderNumber,
        whatsapp.rupees(amount),
        toWallet ? 'credited to your Krozenda wallet' : 'sent to your original payment method (5-7 working days)',
      ],
    });
  } catch (err) {
    console.error('[buyerAlert] refund processed failed:', err.message);
  }
}

// Carrier events worth a message of their own. A re-attempt on another day is
// a new message, so the date is part of the key.
const MILESTONES = {
  OUT_FOR_DELIVERY: {
    template: 'OUT_FOR_DELIVERY',
    title: 'Out for delivery today',
    message: (label) => `Your order ${label} is out for delivery today. Please keep your phone reachable.`,
  },
  NDR: {
    template: 'DELIVERY_FAILED',
    title: 'Delivery attempt failed',
    message: (label) =>
      `The courier could not deliver your order ${label}. They will try again — please keep your phone reachable, or contact us from Help & Support.`,
  },
};

// The buyer side of a milestone, shared by both carriers: in-app + push, and
// a WhatsApp keyed per shipment, status and day. Returns the order (lean) so
// the caller can tell whoever has to act on a failed delivery.
async function tellBuyer({ orderId, milestoneKey, shipmentKey, courier, awb }) {
  const milestone = MILESTONES[milestoneKey];
  const order = await Order.findById(orderId).select('user shippingAddress').lean();
  if (!milestone || !order) return null;
  const label = whatsapp.orderNumber(order._id);
  const day = new Date().toISOString().slice(0, 10);

  await createNotification({
    userId: order.user,
    type: 'ORDER',
    title: milestone.title,
    message: milestone.message(label),
    actionType: 'ORDER',
    actionRefId: order._id,
    link: links.buyer.order(order._id),
  });

  whatsapp.sendTemplateOnce({
    key: `SHIPMENT:${shipmentKey}:${milestoneKey}:${day}`,
    template: milestone.template,
    phone: order.shippingAddress?.phone,
    params: [buyerName(order), label, courier || 'our courier partner', awb || 'shared in the app'],
  });
  return { order, label };
}

/**
 * Shiprocket: called by the tracking pipeline when a shipment moves into one
 * of the MILESTONES statuses. Also tells the seller about a failed delivery,
 * since a seller who does not act on an NDR gets the parcel back as an RTO.
 */
async function notifyShipmentMilestone(shipment) {
  if (!MILESTONES[shipment.internalStatus]) return;
  try {
    const told = await tellBuyer({
      orderId: shipment.order,
      milestoneKey: shipment.internalStatus,
      shipmentKey: shipment._id,
      courier: shipment.courierName,
      awb: shipment.awbCode,
    });
    if (!told) return;

    if (shipment.internalStatus === 'NDR' && shipment.vendor) {
      await createNotification({
        vendorId: shipment.vendor,
        type: 'ORDER',
        title: 'Delivery failed — action needed',
        message: `The courier could not deliver order ${told.label} (AWB ${shipment.awbCode || '-'}). Choose re-attempt or return from Shipping, or it will be sent back to you.`,
        actionType: 'ORDER',
        actionRefId: told.order._id,
        link: links.vendor.shipping(),
      });
    }
  } catch (err) {
    console.error('[buyerAlert] shipment milestone failed:', err.message);
  }
}

// CJ's tracking statuses (CjShipment.status) → the shared milestones.
const CJ_MILESTONES = { OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY', DELIVERY_FAILED: 'NDR' };

/**
 * CJ (dropship): called by cjLogisticsService.syncShipment when a CJ parcel
 * moves into out-for-delivery or a failed attempt. CJ orders are admin-owned
 * — there is no seller to tell — so a failed delivery goes to the admins,
 * who are the ones who have to chase CJ about it.
 */
async function notifyCjShipmentMilestone(cjShipment, cjOrder) {
  const milestoneKey = CJ_MILESTONES[cjShipment.status];
  if (!milestoneKey || !cjOrder?.krozendaOrderId) return;
  try {
    const told = await tellBuyer({
      orderId: cjOrder.krozendaOrderId,
      milestoneKey,
      shipmentKey: `CJ-${cjShipment._id}`,
      courier: cjShipment.carrier,
      awb: cjShipment.trackingNumber,
    });
    if (!told || milestoneKey !== 'NDR') return;

    // Lazy: adminAlertService pulls in whatsappService, which requires Order.
    const { alertAdmins } = require('./adminAlertService');
    await alertAdmins({
      event: 'CJ_DELIVERY_FAILED',
      title: 'CJ delivery attempt failed',
      message: `CJ could not deliver dropship order ${told.label} (${cjShipment.carrier || 'CJ'}, tracking ${cjShipment.trackingNumber || '-'}). Follow up with CJ before it is returned.`,
      link: '/admin/cj/shipments',
      key: `CJ_DELIVERY_FAILED:${cjShipment._id}:${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (err) {
    console.error('[buyerAlert] CJ shipment milestone failed:', err.message);
  }
}

module.exports = { notifyRefundProcessed, notifyShipmentMilestone, notifyCjShipmentMilestone, MILESTONES, CJ_MILESTONES };
