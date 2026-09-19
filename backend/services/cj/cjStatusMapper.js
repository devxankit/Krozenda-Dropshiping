// Raw CJ order status -> Krozenda's own fulfillment status. Master plan §19:
// the DB never stores a raw CJ string, so a future CJ status change or a
// second provider never means hunting every call site for a literal
// 'WAIT_SHIPMENT' comparison — only this file needs updating.
//
// Scoped to a CJ SUB-ORDER's fulfillment status, not the parent Krozenda
// Order.status (that aggregate is a customer-checkout-phase concern, out of
// scope here per master plan §35/final scope lock — Phase 1 is admin-side
// only). CjOrder.fulfillmentStatus below is what this maps to.

const CJ_TO_KROZENDA = {
  CREATED: 'PENDING_PAYMENT',
  WAIT_PAY: 'PENDING_PAYMENT',
  PAID: 'CONFIRMED',
  WAIT_SHIPMENT: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

const FALLBACK_STATUS = 'PROCESSING';

function mapCjStatus(cjStatus) {
  return CJ_TO_KROZENDA[cjStatus] || FALLBACK_STATUS;
}

module.exports = { mapCjStatus, CJ_TO_KROZENDA };
