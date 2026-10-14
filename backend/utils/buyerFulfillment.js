// What the BUYER's apps are told about who fulfils an order.
//
// Krozenda stores 'SHOPIFY' on the order. The buyer clients do not know that
// value and must not be sent it:
//
//  1. Their response schemas enumerate the fulfilment type
//     (`z.enum(['STANDARD','DROPSHIP'])`). An unknown value fails the parse
//     and takes down the whole orders screen, not just one field.
//  2. `isDropship` is not a label in those apps, it is a BEHAVIOUR FLAG. It
//     renders "ships directly from our supplier and cannot be cancelled,
//     returned or replaced", and "No Cancellation / No Returns" chips. With a
//     real cancel window and real returns, that text sits next to a working
//     Cancel button and is simply false.
//
// So an externally fulfilled order is reported as STANDARD, and the things
// that actually vary — `canCancel`, `canReturn` — are already computed per
// order and carry the truth.
//
// THE ONE EXCEPTION is the cart (Controllers/cartController.js), where
// `isDropship` still means what the clients think it means: online payment
// only, and "this becomes more than one order". That flag is set there
// directly and deliberately.
//
// Everything here is a translation at the API boundary. Nothing internal ever
// uses it — fulfilment, cancellation, invoicing and reporting all read the
// real `order.fulfillmentType`.

// The only values a buyer client is prepared to receive.
const BUYER_FULFILLMENT_TYPES = Object.freeze(['STANDARD', 'DROPSHIP']);

/**
 * @param {object} order an Order document or plain object
 * @returns {'STANDARD'|'DROPSHIP'}
 */
function buyerFulfillmentType(order) {
  const type = order?.fulfillmentType || 'STANDARD';
  return BUYER_FULFILLMENT_TYPES.includes(type) ? type : 'STANDARD';
}

/**
 * Whether to set the clients' no-cancel/no-return behaviour flag.
 *
 * Always false for a Shopify-fulfilled order: those CAN be cancelled inside
 * the grace window and returned afterwards, so the copy the flag triggers
 * would be a lie.
 */
function buyerIsDropship(order) {
  return order?.fulfillmentType === 'DROPSHIP';
}

module.exports = { buyerFulfillmentType, buyerIsDropship, BUYER_FULFILLMENT_TYPES };
