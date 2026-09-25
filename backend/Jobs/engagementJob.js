const cron = require('node-cron');
const Order = require('../Models/Order');
const Cart = require('../Models/Cart');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const Review = require('../Models/Review');
const Wishlist = require('../Models/Wishlist');
const CheckoutAttempt = require('../Models/CheckoutAttempt');
const NotificationDispatch = require('../Models/NotificationDispatch');
const { createNotification } = require('../Controllers/notificationController');
const { alertAdmins } = require('../services/adminAlertService');
const whatsapp = require('../services/whatsappService');
const links = require('../utils/notificationLinks');
const { resolveUnitPrice, requiresVariant } = require('../utils/pricing');

// Time-based buyer and seller nudges — everything that is not a reaction to
// a request or a webhook, but to time passing:
//
//   every 15 min  payment reminders       checkout reached Razorpay, no order 30 min later
//                 captured, no order      money taken, no order 10 min later → admins
//                 abandoned carts         1 h (push) and 24 h (push + WhatsApp)
//                 review requests         2–5 days after delivery
//   hourly        wishlist alerts         back in stock / price dropped
//                 low stock (sellers)     stock at or under the product's threshold
//
// Same shape as the other Jobs/: a `running` flag per schedule stops a slow
// tick overlapping the next one, and every send is claimed in
// NotificationDispatch first, so two server instances on the same tick never
// double-message anyone. Every step catches its own errors — one failing step
// never stops the others.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const PAYMENT_REMINDER_DELAY = 30 * MIN;
const CAPTURE_ALERT_DELAY = 10 * MIN;
const CART_FIRST_REMINDER = HOUR;
const CART_SECOND_REMINDER = DAY;
const CART_MAX_AGE = 3 * DAY;
const REVIEW_DELAY = 2 * DAY;
const REVIEW_MAX_AGE = 5 * DAY;
const PRICE_DROP_RATIO = 0.95; // at least 5% cheaper …
const PRICE_DROP_MIN_RUPEES = 10; // … and at least ₹10
const MAX_WISHLIST_ALERTS_PER_USER = 3;
const BATCH = 300;

function log(entry) {
  console.log(JSON.stringify({ scope: 'ENGAGEMENT', at: new Date().toISOString(), ...entry }));
}

function day(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function linkText(path) {
  return links.absolute(path) || 'the Krozenda app';
}

async function loadCustomers(ids) {
  const customers = await Customer.find({ _id: { $in: ids }, isActive: true, isDeleted: { $ne: true } })
    .select('name mobileNumber')
    .lean();
  return new Map(customers.map((c) => [String(c._id), c]));
}

// ---------------------------------------------------------------------------
// Payment reminders
// ---------------------------------------------------------------------------

async function sendPaymentReminders(now = new Date()) {
  const attempts = await CheckoutAttempt.find({
    remindedAt: null,
    capturedAt: null,
    createdAt: { $lte: new Date(now - PAYMENT_REMINDER_DELAY), $gte: new Date(now - DAY) },
  })
    .sort({ createdAt: -1 })
    .limit(BATCH)
    .lean();
  if (!attempts.length) return 0;

  // Latest attempt per buyer: a buyer who retried three times gets one
  // reminder, about the most recent amount.
  const latest = new Map();
  for (const a of attempts) if (!latest.has(String(a.user))) latest.set(String(a.user), a);
  const customers = await loadCustomers([...latest.keys()]);

  let sent = 0;
  for (const [userId, attempt] of latest) {
    try {
      const customer = customers.get(userId);
      // Paid after all (another attempt, COD, wallet) or emptied the cart.
      const [ordered, cart] = await Promise.all([
        Order.exists({ user: userId, createdAt: { $gte: attempt.createdAt } }),
        Cart.findOne({ user: userId }).select('items').lean(),
      ]);
      if (!customer || ordered || !cart?.items?.length) continue;
      if (!(await NotificationDispatch.claim(`PAYMENT_REMINDER:${userId}:${day(now)}`, { event: 'PAYMENT_REMINDER' }))) {
        continue;
      }

      const failed = Boolean(attempt.failedAt);
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: failed ? 'Your payment did not go through' : 'Complete your payment',
        message: `${failed ? 'Your payment' : 'Your order'} of ₹${attempt.amount.toLocaleString('en-IN')} is not complete yet. Your cart is saved — tap to finish checkout.`,
        link: links.buyer.cart(),
      });
      await whatsapp.sendTemplateOnce({
        key: `PAYMENT_REMINDER_WA:${userId}:${day(now)}`,
        template: 'PAYMENT_PENDING',
        phone: customer.mobileNumber,
        params: [whatsapp.firstName(customer.name), whatsapp.rupees(attempt.amount), linkText(links.buyer.cart())],
      });
      sent += 1;
    } catch (err) {
      console.error(`[engagementJob] payment reminder for ${userId} failed:`, err.message);
    }
  }

  // Everything looked at is done with, sent or not — never reconsidered.
  await CheckoutAttempt.updateMany(
    { _id: { $in: attempts.map((a) => a._id) } },
    { $set: { remindedAt: now } }
  );
  return sent;
}

// ---------------------------------------------------------------------------
// Captured payment, no order
// ---------------------------------------------------------------------------

async function alertCapturedWithoutOrder(now = new Date()) {
  const attempts = await CheckoutAttempt.find({
    capturedAt: { $ne: null, $lte: new Date(now - CAPTURE_ALERT_DELAY) },
    captureAlertedAt: null,
  })
    .limit(BATCH)
    .lean();

  let alerted = 0;
  for (const attempt of attempts) {
    try {
      const ordered = await Order.exists({ razorpayPaymentId: attempt.razorpayPaymentId });
      if (!ordered) {
        await alertAdmins({
          event: 'PAYMENT_WITHOUT_ORDER',
          title: 'Payment captured, no order',
          message: `₹${attempt.amount.toLocaleString('en-IN')} was captured (payment ${attempt.razorpayPaymentId}) but no order was placed. Refund it or create the order by hand.`,
          link: '/admin/orders',
          key: `PAYMENT_WITHOUT_ORDER:${attempt.razorpayPaymentId}`,
          urgent: true,
        });
        alerted += 1;
      }
      await CheckoutAttempt.updateOne({ _id: attempt._id }, { $set: { captureAlertedAt: now } });
    } catch (err) {
      console.error(`[engagementJob] capture check for ${attempt.razorpayPaymentId} failed:`, err.message);
    }
  }
  return alerted;
}

// ---------------------------------------------------------------------------
// Abandoned carts
// ---------------------------------------------------------------------------

async function sendCartReminders(now = new Date()) {
  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: new Date(now - CART_FIRST_REMINDER), $gte: new Date(now - CART_MAX_AGE) },
  })
    .populate('items.product', 'name')
    .limit(BATCH)
    .lean();
  if (!carts.length) return 0;

  const customers = await loadCustomers(carts.map((c) => c.user));
  let sent = 0;
  for (const cart of carts) {
    try {
      const userId = String(cart.user);
      const customer = customers.get(userId);
      if (!customer) continue;

      const age = now - new Date(cart.updatedAt);
      const stage = age >= CART_SECOND_REMINDER ? 2 : 1;
      // The cart's last change is part of the key: editing the cart starts a
      // fresh 1 h / 24 h cycle, leaving it alone never repeats a stage.
      const key = `CART_REMINDER:${cart._id}:${new Date(cart.updatedAt).getTime()}:${stage}`;

      // A buyer who was just told "complete your payment" does not also need
      // "you left something in your cart".
      const recentlyReminded = await NotificationDispatch.exists({
        key: { $in: [`PAYMENT_REMINDER:${userId}:${day(now)}`, `PAYMENT_REMINDER:${userId}:${day(new Date(now - DAY))}`] },
      });
      if (recentlyReminded) continue;
      if (!(await NotificationDispatch.claim(key, { event: 'CART_REMINDER' }))) continue;

      const count = cart.items.reduce((sum, i) => sum + Number(i.quantity || 1), 0);
      const first = cart.items.find((i) => i.product?.name)?.product?.name || 'your items';
      await createNotification({
        userId,
        type: 'OFFER',
        title: stage === 1 ? 'You left something in your cart' : 'Your cart is still waiting',
        message: `${first}${count > 1 ? ` and ${count - 1} more item(s)` : ''} ${count > 1 ? 'are' : 'is'} still in your cart. Complete your order before it sells out.`,
        link: links.buyer.cart(),
      });
      // WhatsApp only on the second nudge — it is a paid Marketing message.
      if (stage === 2) {
        await whatsapp.sendTemplateOnce({
          key: `${key}:WA`,
          template: 'CART_REMINDER',
          phone: customer.mobileNumber,
          params: [whatsapp.firstName(customer.name), String(count), first, linkText(links.buyer.cart())],
        });
      }
      sent += 1;
    } catch (err) {
      console.error(`[engagementJob] cart reminder for ${cart._id} failed:`, err.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Review requests
// ---------------------------------------------------------------------------

async function sendReviewRequests(now = new Date()) {
  const window = { $lte: new Date(now - REVIEW_DELAY), $gte: new Date(now - REVIEW_MAX_AGE) };
  const orders = await Order.find({
    status: 'DELIVERED',
    $or: [
      { deliveredAt: window },
      { deliveredAt: null, statusHistory: { $elemMatch: { status: 'DELIVERED', at: window } } },
    ],
  })
    .select('user items shippingAddress')
    .limit(BATCH)
    .lean();

  let sent = 0;
  for (const order of orders) {
    try {
      const live = (order.items || []).filter((i) => i.status !== 'CANCELLED');
      const reviewed = await Review.find({ user: order.user, product: { $in: live.map((i) => i.product) } })
        .select('product')
        .lean();
      const reviewedIds = new Set(reviewed.map((r) => String(r.product)));
      const pending = live.filter((i) => !reviewedIds.has(String(i.product)));
      if (!pending.length) continue;
      if (!(await NotificationDispatch.claim(`REVIEW_REQUEST:${order._id}`, { event: 'REVIEW_REQUEST' }))) continue;

      const productText = `${pending[0].name}${pending.length > 1 ? ` and ${pending.length - 1} more` : ''}`;
      await createNotification({
        userId: order.user,
        type: 'ORDER',
        title: 'How was your order?',
        message: `Tell other shoppers what you think of ${productText}. It takes less than a minute.`,
        actionType: 'ORDER',
        actionRefId: order._id,
        link: links.buyer.review(order._id),
      });
      await whatsapp.sendTemplateOnce({
        key: `REVIEW_REQUEST_WA:${order._id}`,
        template: 'REVIEW_REQUEST',
        phone: order.shippingAddress?.phone,
        params: [
          whatsapp.firstName(order.shippingAddress?.fullName),
          productText,
          linkText(links.buyer.review(order._id)),
        ],
      });
      sent += 1;
    } catch (err) {
      console.error(`[engagementJob] review request for ${order._id} failed:`, err.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Wishlist: back in stock / price dropped
// ---------------------------------------------------------------------------

// What a shopper would see on the product card: the cheapest buyable price
// and whether anything at all can be bought.
function productSnapshot(product) {
  const visible =
    product.isActive !== false &&
    !['PENDING', 'REJECTED'].includes(product.approvalStatus) &&
    !['Draft', 'Inactive'].includes(product.status);
  if (requiresVariant(product)) {
    const variants = product.variants.filter((v) => v.isActive !== false);
    const prices = variants.map((v) => resolveUnitPrice(product, { variantId: v._id }).unitPrice);
    return {
      visible,
      price: prices.length ? Math.min(...prices) : null,
      inStock: variants.some((v) => Number(v.stock || 0) > 0),
    };
  }
  return { visible, price: resolveUnitPrice(product).unitPrice, inStock: Number(product.stock || 0) > 0 };
}

async function sendWishlistAlerts() {
  let alerts = 0;
  const cursor = Wishlist.find({ 'items.0': { $exists: true } }).lean().cursor({ batchSize: 100 });

  for await (const wishlist of cursor) {
    try {
      const products = await Product.find({ _id: { $in: wishlist.items.map((i) => i.product) } })
        .select('name price salePrice stock variants priceTiers isActive approvalStatus status')
        .lean();
      const byId = new Map(products.map((p) => [String(p._id), p]));

      const updates = [];
      let sentForUser = 0;
      for (const item of wishlist.items) {
        const product = byId.get(String(item.product));
        if (!product) continue;
        const snap = productSnapshot(product);
        if (!snap.visible || snap.price === null) continue;

        const firstLook = item.lastPrice === null || item.lastPrice === undefined || item.lastInStock === null || item.lastInStock === undefined;
        let event = null;
        if (!firstLook) {
          if (!item.lastInStock && snap.inStock) event = 'BACK_IN_STOCK';
          else if (
            snap.inStock &&
            snap.price <= item.lastPrice * PRICE_DROP_RATIO &&
            item.lastPrice - snap.price >= PRICE_DROP_MIN_RUPEES
          ) {
            event = 'PRICE_DROP';
          }
        }

        if (event && sentForUser < MAX_WISHLIST_ALERTS_PER_USER) {
          const key = `WISHLIST:${item._id}:${event}:${event === 'PRICE_DROP' ? snap.price : day()}`;
          if (await NotificationDispatch.claim(key, { event: `WISHLIST_${event}`, channel: 'PUSH' })) {
            await createNotification({
              userId: wishlist.user,
              type: 'OFFER',
              title: event === 'BACK_IN_STOCK' ? 'Back in stock!' : 'Price dropped on your wishlist',
              message:
                event === 'BACK_IN_STOCK'
                  ? `${product.name} from your wishlist is back in stock. Grab it before it runs out again.`
                  : `${product.name} is now ₹${snap.price.toLocaleString('en-IN')} (was ₹${item.lastPrice.toLocaleString('en-IN')}).`,
              link: links.buyer.product(product._id),
            });
            sentForUser += 1;
            alerts += 1;
          }
        }

        if (item.lastPrice !== snap.price || item.lastInStock !== snap.inStock) {
          updates.push({
            updateOne: {
              filter: { _id: wishlist._id, 'items._id': item._id },
              update: { $set: { 'items.$.lastPrice': snap.price, 'items.$.lastInStock': snap.inStock } },
            },
          });
        }
      }
      if (updates.length) await Wishlist.bulkWrite(updates, { ordered: false });
    } catch (err) {
      console.error(`[engagementJob] wishlist ${wishlist._id} failed:`, err.message);
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Low stock (sellers)
// ---------------------------------------------------------------------------

function defaultLowStockThreshold() {
  const value = Number(process.env.LOW_STOCK_DEFAULT_THRESHOLD);
  return Number.isFinite(value) && value >= 0 ? value : 5;
}

function isLowStock(product, threshold) {
  if (requiresVariant(product)) {
    return product.variants.filter((v) => v.isActive !== false).some((v) => Number(v.stock || 0) <= threshold);
  }
  return Number(product.stock || 0) <= threshold;
}

async function sendLowStockAlerts() {
  const fallback = defaultLowStockThreshold();
  const products = await Product.find({
    vendor: { $ne: null },
    isActive: true,
    approvalStatus: { $ne: 'REJECTED' },
  })
    .select('name vendor stock lowStockThreshold variants')
    .lean();

  // One alert per dip: a product's LOW_STOCK key stays until it is restocked
  // above its threshold (cleared below), so a product sitting at 2 units is
  // not re-announced every hour.
  const armed = await NotificationDispatch.find({ key: /^LOW_STOCK:/ }).select('key').lean();
  const armedIds = new Set(armed.map((d) => d.key.slice('LOW_STOCK:'.length)));

  const lowIds = new Set();
  const newlyLowByVendor = new Map();
  for (const product of products) {
    const threshold = product.lowStockThreshold ?? fallback;
    if (!isLowStock(product, threshold)) continue;
    lowIds.add(String(product._id));
    if (armedIds.has(String(product._id))) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await NotificationDispatch.claim(`LOW_STOCK:${product._id}`, { event: 'LOW_STOCK', channel: 'PUSH' })) {
      const list = newlyLowByVendor.get(String(product.vendor)) || [];
      list.push(product.name);
      newlyLowByVendor.set(String(product.vendor), list);
    }
  }

  // Re-arm products that were restocked.
  const restocked = armed.filter((d) => !lowIds.has(d.key.slice('LOW_STOCK:'.length))).map((d) => d.key);
  if (restocked.length) await NotificationDispatch.deleteMany({ key: { $in: restocked } });

  for (const [vendorId, names] of newlyLowByVendor) {
    const shown = names.slice(0, 3).map((n) => `"${n}"`).join(', ');
    // eslint-disable-next-line no-await-in-loop
    await createNotification({
      vendorId,
      type: 'SYSTEM',
      title: names.length === 1 ? 'Low stock alert' : `${names.length} products are running low`,
      message: `${shown}${names.length > 3 ? ` and ${names.length - 3} more` : ''} ${names.length === 1 ? 'is' : 'are'} running low on stock. Restock soon so you do not miss orders.`,
      link: links.vendor.inventory(),
    });
  }
  return newlyLowByVendor.size;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

async function step(name, fn) {
  try {
    const count = await fn();
    if (count) log({ event: 'ENGAGEMENT_STEP', step: name, count });
  } catch (err) {
    console.error(`[engagementJob] ${name} failed:`, err.message);
  }
}

let frequentRunning = false;
let hourlyRunning = false;
const tasks = [];

async function runFrequent() {
  if (frequentRunning) return;
  frequentRunning = true;
  try {
    await step('paymentReminders', () => sendPaymentReminders());
    await step('capturedWithoutOrder', () => alertCapturedWithoutOrder());
    await step('cartReminders', () => sendCartReminders());
    await step('reviewRequests', () => sendReviewRequests());
  } finally {
    frequentRunning = false;
  }
}

async function runHourly() {
  if (hourlyRunning) return;
  hourlyRunning = true;
  try {
    await step('wishlistAlerts', () => sendWishlistAlerts());
    await step('lowStockAlerts', () => sendLowStockAlerts());
  } finally {
    hourlyRunning = false;
  }
}

function scheduleEngagementJobs() {
  if (process.env.ENGAGEMENT_JOBS_ENABLED === 'false') {
    console.log('[engagementJob] disabled by ENGAGEMENT_JOBS_ENABLED=false');
    return;
  }
  const frequent = process.env.ENGAGEMENT_CRON || '*/15 * * * *';
  const hourly = process.env.ENGAGEMENT_HOURLY_CRON || '7 * * * *';
  for (const [schedule, run, name] of [
    [frequent, runFrequent, 'frequent'],
    [hourly, runHourly, 'hourly'],
  ]) {
    if (!cron.validate(schedule)) {
      console.error(`[engagementJob] invalid ${name} cron "${schedule}" — not scheduled`);
      continue;
    }
    tasks.push(cron.schedule(schedule, run));
    console.log(`[engagementJob] ${name} scheduled with cron "${schedule}"`);
  }
}

function stopEngagementJobs() {
  while (tasks.length) tasks.pop().stop();
}

module.exports = {
  scheduleEngagementJobs,
  stopEngagementJobs,
  runFrequent,
  runHourly,
  sendPaymentReminders,
  alertCapturedWithoutOrder,
  sendCartReminders,
  sendReviewRequests,
  sendWishlistAlerts,
  sendLowStockAlerts,
  productSnapshot,
};
