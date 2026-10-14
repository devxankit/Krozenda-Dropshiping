const { graphql, userErrorsOf, ShopifyError, log } = require('./shopifyClient');
const { withAuth } = require('./shopifyAuthService');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const ShopifySettings = require('../../Models/ShopifySettings');
const { toProvinceCode } = require('../../utils/indianStates');

// Raising the order with Shopify, already paid.
//
// THE MONEY MODEL, because everything here follows from it: the buyer pays
// KROZENDA, through Krozenda's own Razorpay account. Shopify never touches
// that money and never charges anyone. The order is pushed in with
// financialStatus PAID and a matching SALE transaction, purely so the
// dropshipping app on the store sees a paid order and fulfils it.
//
// Three consequences that are easy to get wrong:
//
//  1. `options.sendReceipt: false`. Without it SHOPIFY EMAILS YOUR CUSTOMER,
//     from the Shopify store, about an order they placed on Krozenda. Buyer
//     communication belongs to Krozenda alone.
//  2. The transaction's `gateway` is a label, not a processor. Nothing is
//     charged by it; it exists so the money's origin is legible in Shopify.
//  3. `inventoryBehaviour: DECREMENT_OBEYING_POLICY`. THIS order is the single
//     decrement of Shopify stock. Krozenda must never also push a quantity for
//     an imported product, or the same sale is counted twice.

const ORDER_CREATE = `
  mutation KrozendaOrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        # Read back so a silently discarded address is caught here rather than
        # by a supplier who cannot ship.
        shippingAddress { address1 city zip }
      }
      userErrors { field message }
    }
  }
`;

const ORDER_BY_TAG = `
  query KrozendaOrderByTag($query: String!) {
    orders(first: 1, query: $query) {
      nodes { id name displayFinancialStatus displayFulfillmentStatus createdAt }
    }
  }
`;

const ORDER_STATUS = `
  query KrozendaOrderStatus($id: ID!) {
    order(id: $id) {
      id
      name
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      fulfillments(first: 10) {
        id
        status
        createdAt
        trackingInfo { number url company }
      }
    }
  }
`;

const ORDER_CANCEL = `
  mutation KrozendaOrderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) {
      job { id }
      orderCancelUserErrors { field message code }
    }
  }
`;

function money(amount, currencyCode) {
  return { shopMoney: { amount: Number(amount || 0).toFixed(2), currencyCode } };
}

// The tag every Krozenda order carries. It is the ONLY way to find an order
// again after a timeout: orderCreate is not idempotent, so without a
// fingerprint a retry quietly creates a second supplier order for one sale.
// SHOPIFY TAGS ARE CAPPED AT 40 CHARACTERS and the whole order is rejected
// with a flat "Order tags is invalid" if one is longer.
//
// `krozenda-order:<24-char id>` was 39 — under the cap by one character,
// which is why it worked. Appending the supplier made it 54 and every order
// began failing. So the format is deliberately terse, and guarded below.
const MAX_TAG_LENGTH = 40;

// Two letters per supplier, so the tag stays well inside the cap however long
// the supplier's name is.
const SUPPLIER_TAG_CODE = Object.freeze({
  VFULFILL: 'VF',
  DROPSHIP_INDIA: 'DI',
});

function orderTag(krozendaOrderId, supplier = null) {
  // The supplier is part of the fingerprint because one Krozenda order can
  // produce several Shopify orders — one per supplier. Without it, the
  // duplicate check would find vFulfill's order and wrongly conclude that
  // Dropship India's had already been created.
  const code = supplier && supplier !== 'UNKNOWN' ? SUPPLIER_TAG_CODE[supplier] || supplier.slice(0, 2) : null;
  return code ? `kz-${krozendaOrderId}-${code}` : `kz-${krozendaOrderId}`;
}

// The tag format before the per-supplier split. Still searched when looking
// for an existing order, so an order placed before this change is still
// found and adopted rather than created a second time.
function legacyOrderTag(krozendaOrderId) {
  return `krozenda-order:${krozendaOrderId}`;
}

/** Refuse locally rather than let Shopify reject the whole order. */
function assertTagsValid(tags) {
  const tooLong = tags.filter((t) => String(t).length > MAX_TAG_LENGTH);
  if (tooLong.length > 0) {
    throw new ShopifyError(
      `Shopify tags are limited to ${MAX_TAG_LENGTH} characters; these are longer: ${tooLong.join(', ')}`,
      { code: 'TAG_TOO_LONG' }
    );
  }
  return tags;
}

// SHOPIFY SILENTLY DISCARDS THE WHOLE SHIPPING ADDRESS when lastName is
// empty. It does not refuse the order — it accepts it and drops the address,
// so the order looks perfectly healthy and is undeliverable. Two real orders
// reached a supplier with no address at all before this was found.
//
// Verified against the live API: an empty lastName, a missing lastName, and
// no name fields at all each lose the address; any non-empty lastName keeps
// it. A single-word name therefore goes in lastName — which also renders
// correctly on a label, unlike duplicating it or padding it with a dot.
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  // lastName must NEVER be empty. Everything else here is cosmetic.
  if (parts.length === 0) return { firstName: '', lastName: 'Customer' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function buildAddress(shippingAddress) {
  const { firstName, lastName } = splitName(shippingAddress.fullName);
  const provinceCode = toProvinceCode(shippingAddress.state);
  return {
    firstName,
    lastName,
    address1: shippingAddress.line1 || '',
    address2: shippingAddress.line2 || '',
    city: shippingAddress.city || '',
    // Omitted rather than guessed when the state cannot be matched: a wrong
    // province sends the parcel to the wrong end of the country, while a
    // missing one is corrected by the PIN code sitting right beside it.
    ...(provinceCode ? { provinceCode } : {}),
    zip: shippingAddress.pincode || '',
    countryCode: 'IN',
    phone: shippingAddress.phone || '',
  };
}

/**
 * Map Krozenda order lines to Shopify line items.
 *
 * A line whose variant cannot be resolved aborts the whole push. Sending a
 * partial order would have the supplier ship some of what the buyer paid for
 * and nothing at all for the rest, with no record of why.
 */
async function buildLineItems(order, { productIds: only = null } = {}) {
  const wanted = only ? new Set(only.map(String)) : null;
  const productIds = (order.items || []).map((item) => item.product);
  const mappings = await ProductFulfillmentMapping.find({ provider: 'SHOPIFY', product: { $in: productIds } }).lean();
  const byProduct = new Map(mappings.map((m) => [String(m.product), m]));

  const lineItems = [];
  for (const item of order.items || []) {
    if (item.status === 'CANCELLED') continue;
    // Only this supplier's lines. A Shopify order carrying another
    // supplier's items is the ambiguity this split exists to remove.
    if (wanted && !wanted.has(String(item.product))) continue;

    const mapping = byProduct.get(String(item.product));
    if (!mapping) {
      throw new ShopifyError(`"${item.name}" is no longer linked to the Shopify store.`, {
        code: 'MAPPING_MISSING',
      });
    }

    const variants = mapping.variants || [];
    // Matched by variant id; only a product with exactly one variant may fall
    // back, because guessing variants[0] on a multi-variant product ships the
    // wrong colour or size while reporting success.
    const variant = item.variantId
      ? variants.find((v) => v.krozendaVariantId && String(v.krozendaVariantId) === String(item.variantId))
      : variants.length === 1
        ? variants[0]
        : null;

    if (!variant?.externalVariantId) {
      throw new ShopifyError(`Could not work out which Shopify variant "${item.name}" refers to.`, {
        code: 'VARIANT_UNRESOLVED',
      });
    }

    lineItems.push({
      variantId: variant.externalVariantId,
      quantity: item.quantity,
      // The price the BUYER paid on Krozenda, not Shopify's own list price.
      // The Shopify order has to reconcile against the money actually taken.
      priceSet: money(item.price, 'INR'),
      requiresShipping: true,
    });
  }

  if (lineItems.length === 0) {
    throw new ShopifyError('This order has no live items to send.', { code: 'NO_LINE_ITEMS' });
  }
  return lineItems;
}

const run = (query, variables, { isMutation = false, estimatedCost = 20 } = {}) =>
  withAuth(({ accessToken, shopDomain, apiVersion }) =>
    graphql({ query, variables, accessToken, shopDomain, apiVersion, isMutation, estimatedCost })
  );

/**
 * Has this Krozenda order already been raised with Shopify?
 *
 * Checked before every retry. orderCreate cannot be made idempotent, so this
 * tag lookup is what stops a timed-out first attempt becoming two supplier
 * orders for one sale.
 */
async function findExistingOrder(krozendaOrderId, supplier = null) {
  const data = await run(
    ORDER_BY_TAG,
    { query: `tag:'${orderTag(krozendaOrderId, supplier)}'` },
    { estimatedCost: 10 }
  );
  const hit = data?.orders?.nodes?.[0];
  if (hit) return hit;

  // Fall back to the pre-split tag, so an order pushed before the format
  // changed is still recognised instead of being created a second time.
  const legacy = await run(ORDER_BY_TAG, { query: `tag:'${legacyOrderTag(krozendaOrderId)}'` }, { estimatedCost: 10 });
  return legacy?.orders?.nodes?.[0] || null;
}

/**
 * Create the paid order on Shopify.
 *
 * @param {object} order a Krozenda Order document (plain object is fine)
 * @param {object} [opts]
 * @param {boolean} [opts.test] create it as a Shopify TEST order
 */
/**
 * The buyer, as Shopify's customer input.
 *
 * Sent so the dropshipping app has a real customer to ship to and contact,
 * and so the order is not an anonymous row in the merchant's Shopify admin.
 * `toUpsert` rather than `toAssociate`: the buyer exists in Krozenda, not
 * necessarily in Shopify, and upsert matches an existing Shopify customer by
 * email or phone instead of creating a duplicate for every order.
 */
function buildCustomer(order, buyer) {
  const address = order.shippingAddress || {};
  const { firstName, lastName } = splitName(address.fullName || buyer?.name);
  const email = buyer?.email || undefined;
  const phone = address.phone || buyer?.mobileNumber || undefined;

  // AN EMAIL IS MANDATORY. Shopify's upsert needs an id or an email; a phone
  // number alone is refused and takes the whole order with it. Krozenda's
  // buyers sign in by mobile OTP, so most have no email — and for them no
  // customer record is sent at all.
  //
  // Nothing is lost by that: the shipping address and the phone travel on the
  // order itself, which is what the supplier needs to deliver and to call.
  // A customer record is a nicety; the order is not.
  if (!email) return null;

  return {
    toUpsert: {
      firstName,
      lastName,
      email,
      // Shopify wants E.164. A 10-digit Indian mobile is stored bare here.
      ...(phone ? { phone: /^\+/.test(phone) ? phone : `+91${String(phone).replace(/\D/g, '').slice(-10)}` } : {}),
    },
  };
}

/**
 * Create the paid order on Shopify for ONE supplier.
 *
 * @param {object}  order
 * @param {object}  [opts]
 * @param {boolean} [opts.test]        create it as a Shopify TEST order
 * @param {string}  [opts.supplier]    which dropshipping app this is for
 * @param {Array}   [opts.productIds]  limit the order to these lines
 * @param {number}  [opts.shippingFee] this supplier's share of delivery
 * @param {object}  [opts.buyer]       the Customer, for the Shopify customer record
 */
async function createOrder(order, { test = false, supplier = null, productIds = null, shippingFee = null, buyer = null } = {}) {
  const settings = await ShopifySettings.getSettings();
  const currency = settings.shopCurrency || 'INR';

  const lineItems = await buildLineItems(order, { productIds });
  // The supplier's own share, not the whole order: with the order split
  // across suppliers, sending each one the full total would overstate every
  // Shopify order and make the store's revenue meaningless.
  const delivery = shippingFee === null ? Number(order.shippingFee || 0) : Number(shippingFee || 0);
  const goods = lineItems.reduce((sum, li) => sum + Number(li.priceSet.shopMoney.amount) * li.quantity, 0);
  const total = Math.round((goods + delivery) * 100) / 100;

  const payload = {
    order: {
      currency,
      presentmentCurrency: currency,
      phone: order.shippingAddress?.phone || undefined,
      email: buyer?.email || undefined,
      ...(buildCustomer(order, buyer) ? { customer: buildCustomer(order, buyer) } : {}),
      financialStatus: 'PAID',
      // The store prices tax-inclusive, so the amounts sent are gross. Saying
      // otherwise would have Shopify add tax on top of a price that has it.
      taxesIncluded: settings.shopTaxesIncluded !== false,
      lineItems,
      shippingAddress: buildAddress(order.shippingAddress || {}),
      // Same address: Krozenda takes one address at checkout, and a Shopify
      // order with no billing address shows as incomplete in some apps.
      billingAddress: buildAddress(order.shippingAddress || {}),
      shippingLines:
        delivery > 0
          ? [
              {
                title: order.providerShippingLineTitle || 'Delivery',
                priceSet: money(delivery, currency),
                code: 'KROZENDA',
                source: 'Krozenda',
              },
            ]
          : [],
      transactions: [
        {
          kind: 'SALE',
          status: 'SUCCESS',
          // A label, not a processor. Shopify charges nothing — this records
          // that the money was taken elsewhere, so the order reconciles.
          gateway: 'Krozenda (Razorpay)',
          amountSet: money(total, currency),
          processedAt: new Date().toISOString(),
          ...(test ? { test: true } : {}),
        },
      ],
      tags: assertTagsValid([
        'krozenda',
        orderTag(order._id),
        ...(supplier && supplier !== 'UNKNOWN'
          ? [orderTag(order._id, supplier), `sup-${SUPPLIER_TAG_CODE[supplier] || supplier.slice(0, 2)}`]
          : []),
      ]),
      customAttributes: [
        { key: 'krozenda_order_id', value: String(order._id) },
        { key: 'krozenda_payment_id', value: String(order.razorpayPaymentId || '') },
        { key: 'krozenda_payment_method', value: String(order.paymentMethod || '') },
        ...(supplier ? [{ key: 'krozenda_supplier', value: String(supplier) }] : []),
      ],
      note: `Placed and paid on Krozenda. Order ${String(order._id).slice(-8).toUpperCase()}.`,
      sourceName: 'krozenda',
      ...(test ? { test: true } : {}),
    },
    options: {
      // Krozenda owns buyer communication. Without these two, Shopify emails
      // the customer about an order they placed somewhere else entirely.
      sendReceipt: false,
      sendFulfillmentReceipt: false,
      // THIS is the single decrement of Shopify stock for the sale.
      inventoryBehaviour: 'DECREMENT_OBEYING_POLICY',
    },
  };

  const data = await run(ORDER_CREATE, payload, { isMutation: true, estimatedCost: 30 });
  const result = data?.orderCreate;

  // A refused mutation is an HTTP 200 with an empty order and a populated
  // userErrors — so it must be checked explicitly or a refusal reads as a win.
  const userError = userErrorsOf(result);
  if (userError) {
    throw new ShopifyError(`Shopify rejected the order: ${userError}`, { code: 'ORDER_REJECTED', body: userError });
  }
  if (!result?.order?.id) {
    throw new ShopifyError('Shopify returned no order.', { code: 'NO_ORDER_RETURNED' });
  }

  // Shopify accepts an order and quietly drops an address it dislikes, so
  // the only reliable check is to read back what it actually stored.
  if (!result.order.shippingAddress?.address1) {
    log({
      event: 'SHOPIFY_ORDER_ADDRESS_DROPPED',
      krozendaOrderId: String(order._id),
      shopifyOrderId: result.order.id,
      shopifyOrderName: result.order.name,
    });
    const { alertAdmins } = require('../adminAlertService');
    await alertAdmins({
      event: 'SHOPIFY_ORDER_ADDRESS_DROPPED',
      title: 'Order reached Shopify with no delivery address',
      message:
        `Order ${String(order._id).slice(-8).toUpperCase()} was created in Shopify as ${result.order.name}, but Shopify ` +
        `discarded the shipping address, so the supplier cannot deliver it. Add the address to ${result.order.name} in ` +
        `Shopify by hand, then tell the supplier.`,
      link: `/admin/orders/detail/${order._id}`,
      key: `SHOPIFY_ADDRESS_DROPPED:${order._id}`,
      urgent: true,
    });
  }

  log({
    event: 'SHOPIFY_ORDER_CREATED',
    krozendaOrderId: String(order._id),
    supplier: supplier || 'UNKNOWN',
    lines: lineItems.length,
    total,
    shopifyOrderId: result.order.id,
    shopifyOrderName: result.order.name,
    financialStatus: result.order.displayFinancialStatus,
    test,
  });

  return result.order;
}

async function getOrderStatus(shopifyOrderId) {
  const data = await run(ORDER_STATUS, { id: shopifyOrderId }, { estimatedCost: 15 });
  return data?.order || null;
}

/**
 * Ask Shopify to cancel.
 *
 * `refund: false` deliberately — Shopify holds none of the buyer's money, so
 * there is nothing for it to refund. Krozenda refunds through Razorpay.
 * `restock: true` puts the stock back, which the inventory mirror then picks up.
 */
async function cancelOrder(shopifyOrderId, { reason = 'OTHER' } = {}) {
  const data = await run(
    ORDER_CANCEL,
    { orderId: shopifyOrderId, reason, refund: false, restock: true, notifyCustomer: false },
    { isMutation: true, estimatedCost: 20 }
  );
  const errors = data?.orderCancel?.orderCancelUserErrors || [];
  if (errors.length) {
    throw new ShopifyError(`Shopify refused the cancellation: ${errors.map((e) => e.message).join('; ')}`, {
      code: 'CANCEL_REJECTED',
    });
  }
  return data?.orderCancel?.job || null;
}

module.exports = {
  createOrder,
  findExistingOrder,
  getOrderStatus,
  cancelOrder,
  orderTag,
  buildLineItems,
  buildAddress,
  buildCustomer,
  splitName,
  assertTagsValid,
  MAX_TAG_LENGTH,
};
