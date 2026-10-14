// Standard e-commerce return window — no such rule existed before, so a
// return could be filed against a delivery from years ago. 7 days is a
// reasonable default; tune here if the business wants a different policy.
const RETURN_WINDOW_DAYS = 7;

function returnDeadline(deliveredAt, fallbackDate) {
  const base = deliveredAt || fallbackDate;
  if (!base) return null;
  return new Date(new Date(base).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function isWithinReturnWindow(deliveredAt, fallbackDate) {
  const deadline = returnDeadline(deliveredAt, fallbackDate);
  return Boolean(deadline) && Date.now() <= deadline.getTime();
}

// Whether the buyer can start a return on this order at all: delivered,
// fulfilled by us rather than by an outside provider, inside the window, and
// with at least one line that was returnable when it was bought
// (Order.items[].returnable is snapshotted at checkout).
//
// The provider test is `!== 'STANDARD'`, not `=== 'DROPSHIP'`. The narrower
// version let a Shopify order show a Return button that returnController then
// refused with a 403 — the two disagreed, and the buyer met the disagreement.
// Whatever the policy becomes, both sides must read the same rule.
function canRequestReturn(order) {
  if (order.status !== 'DELIVERED') return false;
  if ((order.fulfillmentType || 'STANDARD') !== 'STANDARD') return false;
  if (!isWithinReturnWindow(order.deliveredAt, order.updatedAt || order.createdAt)) return false;
  return (order.items || []).some((item) => item.returnable !== false && item.status !== 'CANCELLED');
}

module.exports = { RETURN_WINDOW_DAYS, returnDeadline, isWithinReturnWindow, canRequestReturn };
