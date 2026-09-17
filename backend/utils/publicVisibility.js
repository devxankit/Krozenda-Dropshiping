// What "publicly visible" means for a catalog document.
//
// The approval workflow (approvalStatus: PENDING | APPROVED | REJECTED) was
// added after the catalog already had data, and Mongoose's `default: 'APPROVED'`
// only applies to documents created AFTER that — it does not backfill. So every
// pre-existing product, category and brand has NO approvalStatus field at all.
//
// A plain `{ approvalStatus: 'APPROVED' }` filter does not match a document
// where the field is absent. That is not theoretical: on this database it meant
// GET /catalog/categories and GET /catalog/brands returned an empty list for
// every one of the 12 categories and 30 brands actually in the catalog — which
// is why the storefront grew a set of hardcoded fallback categories and brands
// to render instead.
//
// The serializers have always read `p.approvalStatus || 'APPROVED'`, i.e. they
// already treat "absent" as approved. This makes the QUERY agree with them:
// only PENDING and REJECTED are withheld from shoppers.
//
// $nin also keeps the filter usable as part of the compound indexes on
// { isActive, approvalStatus, ... } rather than forcing an $or.
const PUBLIC_APPROVAL_FILTER = { $nin: ['PENDING', 'REJECTED'] };

// The standard "a shopper may see this" predicate. Spread into a query.
const publiclyVisible = () => ({ isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER });

module.exports = { PUBLIC_APPROVAL_FILTER, publiclyVisible };
