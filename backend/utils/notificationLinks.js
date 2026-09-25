// Where a push or WhatsApp should take the person who taps it. Paths mirror
// frontend/src/config/routes.js (buyer app under /app, seller panel under
// /seller, admin under /admin) — keep the two in step.

function base() {
  return (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
}

// Absolute URL for a WhatsApp message or FCM's webpush link. Null when
// FRONTEND_URL is unset, so callers can leave the link out instead of sending
// a broken one.
function absolute(path) {
  const root = base();
  return root && path ? `${root}${path}` : null;
}

// FCM only accepts an https webpush link; anything else fails the whole send.
function webpushLink(path) {
  const url = absolute(path);
  return url && url.startsWith('https://') ? url : null;
}

const buyer = {
  order: (id) => (id ? `/app/orders/${id}` : '/app/orders'),
  review: (id) => `/app/orders/${id}/review`,
  cart: () => '/app/cart',
  wallet: () => '/app/wallet',
  product: (id) => `/app/product/${id}`,
  notifications: () => '/app/notifications',
};

const vendor = {
  orders: () => '/seller/orders',
  returns: () => '/seller/returns',
  earnings: () => '/seller/earnings',
  inventory: () => '/seller/inventory',
  shipping: () => '/seller/shipping',
  dashboard: () => '/seller/dashboard',
  notifications: () => '/seller/notifications',
};

const admin = {
  order: (id) => `/admin/orders/detail/${id}`,
  returns: () => '/admin/orders/returns',
  seller: (id) => `/admin/people/sellers/${id}`,
  settlements: () => '/admin/finance/settlements',
  cjOrders: () => '/admin/cj/orders',
  dashboard: () => '/admin/dashboard',
};

// The default landing page for a stored notification, from the fields every
// Notification row already carries.
function linkForNotification({ audience, type, actionType, actionRefId }) {
  if (audience === 'vendor') {
    if (actionType === 'ORDER') return vendor.orders();
    if (actionType === 'WALLET' || type === 'WALLET') return vendor.earnings();
    return vendor.notifications();
  }
  if (actionType === 'ORDER') return buyer.order(actionRefId);
  if (actionType === 'WALLET') return buyer.wallet();
  return buyer.notifications();
}

module.exports = { absolute, webpushLink, linkForNotification, buyer, vendor, admin };
