const ShopifySettings = require('../../Models/ShopifySettings');
const { graphql, ShopifyError, log } = require('./shopifyClient');
const { withAuth } = require('./shopifyAuthService');

// Connecting to Shopify, and proving the connection is actually usable.
//
// "Usable" is a stronger claim than "authenticated", and the difference is the
// whole point of this file. A token can authenticate perfectly and still be
// unable to read a buyer's address, because Shopify does not refuse protected
// customer data — it returns the fields as NULL. An integration built on that
// looks healthy, imports products happily, and only fails at the one moment
// that costs money: when an order is pushed with no address on it.
//
// So connecting checks four separate things, and reports them separately.

const SCOPES_REQUIRED = Object.freeze([
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_locations',
  'read_orders',
  'write_orders',
  'read_fulfillments',
  'read_returns',
  'read_customers',
]);

const SHOP_QUERY = `
  query ShopInfo {
    shop {
      id
      name
      myshopifyDomain
      currencyCode
      taxesIncluded
      ianaTimezone
    }
  }
`;

const LOCATIONS_QUERY = `
  query PrimaryLocations {
    locations(first: 10, includeInactive: false) {
      nodes { id name isActive shipsInventory }
    }
  }
`;

// The protected-customer-data probe.
//
// Reads the newest order and looks for buyer PII. The three outcomes are
// genuinely different and must not be collapsed:
//   - fields present            -> protected data is granted
//   - order exists, fields null -> the plan or the app's data request blocks
//                                  it; pushing orders would send no address
//   - no orders at all          -> cannot tell yet, and saying "OK" would be
//                                  a guess
const PII_PROBE_QUERY = `
  query PiiProbe {
    orders(first: 1, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        shippingAddress { name address1 city zip phone }
        customer { id }
      }
    }
  }
`;

async function fetchShop() {
  return withAuth(({ accessToken, shopDomain, apiVersion }) =>
    graphql({ query: SHOP_QUERY, accessToken, shopDomain, apiVersion, estimatedCost: 5, operationName: 'ShopInfo' })
  );
}

async function fetchPrimaryLocation() {
  const data = await withAuth(({ accessToken, shopDomain, apiVersion }) =>
    graphql({
      query: LOCATIONS_QUERY,
      accessToken,
      shopDomain,
      apiVersion,
      estimatedCost: 10,
      operationName: 'PrimaryLocations',
    })
  );
  const nodes = data?.locations?.nodes || [];
  // The location inventory actually ships from, not merely the first one.
  return nodes.find((l) => l.shipsInventory) || nodes[0] || null;
}

/**
 * @returns {{ok: boolean|null, reason: string}} ok === null means "cannot tell".
 */
async function probeProtectedCustomerData() {
  try {
    const data = await withAuth(({ accessToken, shopDomain, apiVersion }) =>
      graphql({
        query: PII_PROBE_QUERY,
        accessToken,
        shopDomain,
        apiVersion,
        estimatedCost: 10,
        operationName: 'PiiProbe',
      })
    );

    const order = data?.orders?.nodes?.[0];
    if (!order) {
      return {
        ok: null,
        reason:
          'The store has no orders yet, so whether buyer names and addresses are readable cannot be confirmed. It will be checked again on the first order.',
      };
    }

    const address = order.shippingAddress;
    const hasPii = Boolean(address && (address.address1 || address.city || address.zip));
    if (hasPii) return { ok: true, reason: '' };

    return {
      ok: false,
      reason:
        'Shopify returned an order with its shipping address blank. That means protected customer data is not granted — either the app has not requested the name/email/phone/address fields, or the store plan does not allow them. Orders pushed from Krozenda would carry no delivery address.',
    };
  } catch (err) {
    // A 403 here is a scope problem, not a plan problem; say which.
    if (err.code === 'FORBIDDEN') {
      return { ok: false, reason: `Shopify refused to return order data: ${err.message}` };
    }
    return { ok: null, reason: `Could not check protected customer data: ${err.message}` };
  }
}

// Which required scopes are genuinely absent.
//
// Shopify's write scopes IMPLY their read counterpart, and the token response
// lists only the write one — so a token holding `write_products` reports
// `read_products` as missing while reading products perfectly well. Comparing
// the lists naively produced a warning telling the admin to add scopes the app
// already had, which is the kind of false alarm that teaches people to ignore
// real ones. Verified against the live API: reads succeed with only the write
// scope reported.
function missingScopes(granted) {
  const have = new Set(granted || []);
  const satisfied = (scope) => {
    if (have.has(scope)) return true;
    if (scope.startsWith('read_')) return have.has(`write_${scope.slice('read_'.length)}`);
    return false;
  };
  return SCOPES_REQUIRED.filter((scope) => !satisfied(scope));
}

/**
 * Test the connection and cache everything it learns.
 *
 * Never throws for a *reportable* failure — the admin screen needs the detail,
 * not a 500.
 */
async function testConnection({ adminId = null } = {}) {
  const settings = await ShopifySettings.getSettings();
  settings.lastConnectionCheckAt = new Date();

  try {
    const shopData = await fetchShop();
    const shop = shopData?.shop;
    if (!shop) throw new ShopifyError('Shopify returned no shop', { code: 'NO_SHOP' });

    // Keep the domain that actually authenticated. Shopify can report a
    // different .myshopify.com host than the one the app was installed on
    // (both resolve, both issue tokens — verified), and swapping the stored
    // value for a name the admin has never seen only makes the settings screen
    // confusing and the next support conversation harder.
    if (!settings.shopDomain) settings.shopDomain = shop.myshopifyDomain || '';
    settings.canonicalDomain = shop.myshopifyDomain || '';
    settings.shopCurrency = shop.currencyCode || '';
    settings.shopTaxesIncluded = typeof shop.taxesIncluded === 'boolean' ? shop.taxesIncluded : null;

    let location = null;
    try {
      location = await fetchPrimaryLocation();
    } catch (err) {
      log({ event: 'SHOPIFY_LOCATION_LOOKUP_FAILED', error: err.message });
    }
    if (location) {
      settings.primaryLocationId = location.id;
      settings.primaryLocationName = location.name;
    }

    const pii = await probeProtectedCustomerData();
    settings.protectedCustomerDataOk = pii.ok;
    settings.protectedCustomerDataCheckedAt = new Date();

    settings.status = 'CONNECTED';
    settings.lastSuccessAt = new Date();
    settings.failureReason = '';
    if (adminId) settings.updatedBy = adminId;
    await settings.save();

    const missing = missingScopes(settings.grantedScopes);

    const warnings = [];
    if (missing.length) {
      warnings.push(
        `The app is missing ${missing.length} required scope(s): ${missing.join(', ')}. Add them in the Dev Dashboard and release a new version.`
      );
    }
    if (pii.ok === false) warnings.push(pii.reason);
    if (pii.ok === null && pii.reason) warnings.push(pii.reason);
    if (settings.shopCurrency && settings.shopCurrency !== 'INR') {
      warnings.push(
        `The store's currency is ${settings.shopCurrency}, not INR. Prices imported from Shopify are in that currency and need a conversion step before they are shown to buyers.`
      );
    }
    if (!location) warnings.push('No inventory location was found, so stock cannot be synced.');

    log({
      event: 'SHOPIFY_CONNECTION_OK',
      shop: settings.shopDomain,
      currency: settings.shopCurrency,
      piiOk: pii.ok,
      missingScopes: missing.length,
    });

    return {
      ok: true,
      shop: {
        name: shop.name,
        domain: settings.shopDomain,
        currency: settings.shopCurrency,
        taxesIncluded: settings.shopTaxesIncluded,
        timezone: shop.ianaTimezone || '',
      },
      location: location ? { id: location.id, name: location.name } : null,
      protectedCustomerData: pii,
      missingScopes: missing,
      warnings,
      settings: settings.toSafeJSON(),
    };
  } catch (err) {
    settings.status = 'FAILED';
    settings.lastFailureAt = new Date();
    settings.failureReason = err.message.slice(0, 500);
    if (adminId) settings.updatedBy = adminId;
    await settings.save();

    log({ event: 'SHOPIFY_CONNECTION_FAILED', code: err.code, error: err.message });
    return { ok: false, code: err.code || 'CONNECTION_FAILED', message: err.message, settings: settings.toSafeJSON() };
  }
}

module.exports = { testConnection, probeProtectedCustomerData, fetchShop, fetchPrimaryLocation, SCOPES_REQUIRED, missingScopes };
