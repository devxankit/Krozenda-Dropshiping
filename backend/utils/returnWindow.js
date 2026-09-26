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

// Whether the buyer can start a return on this order at all: delivered, not
// dropship, inside the window, and at least one line that was returnable
// when it was bought (Order.items[].returnable is snapshotted at checkout).
function canRequestReturn(order) {
  if (order.status !== 'DELIVERED' || order.fulfillmentType === 'DROPSHIP') return false;
  if (!isWithinReturnWindow(order.deliveredAt, order.updatedAt || order.createdAt)) return false;
  return (order.items || []).some((item) => item.returnable !== false && item.status !== 'CANCELLED');
}

module.exports = { RETURN_WINDOW_DAYS, returnDeadline, isWithinReturnWindow, canRequestReturn };
