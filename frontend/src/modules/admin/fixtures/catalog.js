import { BUSINESS_MODEL } from '../../../config/constants'
import { PRODUCT_TYPE, REVIEW_STATUS } from '../constants'
import { drop, findOr404, invalid } from './mutable'

// Shapes match schemas/catalogSchema.js. Money is in PAISE.

const PRODUCTS = [
  { id: 'prd-1', name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L', sku: 'KZ-HK-STL-1200', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', category: 'Home & Kitchen › Cookware', brand: 'Nirvaan Steelworks', price: 119900, stock: 1840, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-09-01T14:20:00+05:30' },
  { id: 'prd-2', name: 'Aarohi Cotton Table Runner, 180 cm', sku: 'KZ-HD-RNR-180', type: PRODUCT_TYPE.VARIABLE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Nova Retail Pvt Ltd', category: 'Home Décor › Table Linen', brand: 'Aarohi Living', price: 89900, stock: 620, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-08-31T11:02:00+05:30' },
  { id: 'prd-3', name: 'Vayu 1.5 Ton 3-Star Inverter AC', sku: 'KZ-EL-AC-1503', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Arya Manufacturing', category: 'Electronics › Cooling', brand: 'Vayu Appliances', price: 3600000, stock: 82, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-08-30T09:41:00+05:30' },
  { id: 'prd-4', name: 'Surya Cold-Pressed Groundnut Oil, 5 L', sku: 'KZ-GR-OIL-5000', type: PRODUCT_TYPE.PACK_SIZE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Meghna Wholesale', category: 'Grocery & Staples › Edible Oil', brand: 'Surya Foods', price: 90000, stock: 2410, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-09-02T08:15:00+05:30' },
  { id: 'prd-5', name: 'Meher Handloom Cotton Kurta', sku: 'KZ-AP-KRT-M', type: PRODUCT_TYPE.VARIABLE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Bharat Textiles LLP', category: 'Apparel › Ethnic Wear', brand: 'Meher Handloom', price: 140000, stock: 388, status: REVIEW_STATUS.REVIEWING, updatedAt: '2026-09-02T10:55:00+05:30' },
  { id: 'prd-6', name: 'Surya Turmeric Powder, 500 g', sku: 'KZ-GR-TUR-500', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', category: 'Grocery & Staples › Spices', brand: 'Surya Foods', price: 18500, stock: 240, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-08-29T16:30:00+05:30' },
  { id: 'prd-7', name: 'Vayu Ceiling Fan 1200 mm, BLDC', sku: 'KZ-EL-FAN-1200', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Arya Manufacturing', category: 'Electronics › Fans', brand: 'Vayu Appliances', price: 349900, stock: 96, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-08-28T12:00:00+05:30' },
  { id: 'prd-8', name: 'Aarohi Jute Storage Basket, Large', sku: 'KZ-HD-BSK-LG', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Nova Retail Pvt Ltd', category: 'Home Décor › Storage', brand: 'Aarohi Living', price: 64900, stock: 18, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-09-01T18:44:00+05:30' },
  { id: 'prd-9', name: 'Nirvaan Silicone Spatula Set of 3', sku: 'KZ-HK-SPT-003', type: PRODUCT_TYPE.SIMPLE, model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', category: 'Home & Kitchen › Utensils', brand: 'Nirvaan Steelworks', price: 49900, stock: 42, status: REVIEW_STATUS.APPROVED, updatedAt: '2026-09-02T07:12:00+05:30' },
  { id: 'prd-10', name: 'Kritika Bulk Cotton Fabric, 100 m roll', sku: 'KZ-AP-FAB-100', type: PRODUCT_TYPE.BULK, model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Kritika Enterprises', category: 'Apparel › Fabric', brand: 'Kritika Mills', price: 2400000, stock: 140, status: REVIEW_STATUS.SUBMITTED, updatedAt: '2026-09-02T09:30:00+05:30' },
  { id: 'prd-11', name: 'Sunrise Wholesale Steel Tumbler, 24-pack', sku: 'KZ-HK-TMB-024', type: PRODUCT_TYPE.WHOLESALE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Sunrise Traders', category: 'Home & Kitchen › Drinkware', brand: 'Sunrise Steel', price: 720000, stock: 260, status: REVIEW_STATUS.CHANGES_REQUESTED, updatedAt: '2026-08-30T15:06:00+05:30' },
  { id: 'prd-12', name: 'Meher Silk Blend Dupatta', sku: 'KZ-AP-DUP-S', type: PRODUCT_TYPE.VARIABLE, model: BUSINESS_MODEL.MARKETPLACE, seller: 'Bharat Textiles LLP', category: 'Apparel › Ethnic Wear', brand: 'Meher Handloom', price: 89000, stock: 0, status: REVIEW_STATUS.REJECTED, updatedAt: '2026-08-27T13:22:00+05:30' },
]

const APPROVALS = [
    { id: 'apr-1', kind: 'brand', name: 'Nirvaan Steelworks', context: 'Home & Kitchen', submittedBy: 'Krozenda Own Stock', submittedAt: '1 Sep 2026', waitingDays: 1, blockedBy: null },
    { id: 'apr-2', kind: 'product', name: 'Kritika Bulk Cotton Fabric, 100 m roll', context: 'Apparel › Fabric', submittedBy: 'Kritika Enterprises', submittedAt: '2 Sep 2026', waitingDays: 0, blockedBy: null },
    { id: 'apr-3', kind: 'product', name: 'Meher Handloom Cotton Kurta', context: 'Apparel › Ethnic Wear', submittedBy: 'Bharat Textiles LLP', submittedAt: '2 Sep 2026', waitingDays: 0, blockedBy: null },
    { id: 'apr-4', kind: 'category', name: 'Electronics › Air Purifiers', context: 'New sub-category', submittedBy: 'Arya Manufacturing', submittedAt: '30 Aug 2026', waitingDays: 3, blockedBy: null },
    { id: 'apr-5', kind: 'product', name: 'Vayu Air Purifier VP-300', context: 'Electronics › Air Purifiers', submittedBy: 'Arya Manufacturing', submittedAt: '30 Aug 2026', waitingDays: 3, blockedBy: 'Category approval' },
  { id: 'apr-6', kind: 'brand', name: 'Sunrise Steel', context: 'Home & Kitchen', submittedBy: 'Sunrise Traders', submittedAt: '28 Aug 2026', waitingDays: 5, blockedBy: null },
]

export function approvalQueueFixture() {
  const items = APPROVALS
  return {
    items,
    tabCounts: {
      all: items.length,
      category: items.filter((i) => i.kind === 'category').length,
      brand: items.filter((i) => i.kind === 'brand').length,
      product: items.filter((i) => i.kind === 'product').length,
    },
  }
}

const CATEGORIES = [
      { id: 'cat-1', name: 'Home & Kitchen', depth: 0, productCount: 28410, commissionRate: 12.5, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-1-1', name: 'Cookware', depth: 1, productCount: 9820, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-1-2', name: 'Utensils', depth: 1, productCount: 7140, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-1-3', name: 'Drinkware', depth: 1, productCount: 4260, commissionRate: 10, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-2', name: 'Apparel', depth: 0, productCount: 31240, commissionRate: 18, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-2-1', name: 'Ethnic Wear', depth: 1, productCount: 12840, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-2-2', name: 'Fabric', depth: 1, productCount: 3620, commissionRate: 8, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-3', name: 'Electronics', depth: 0, productCount: 18640, commissionRate: 8, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-3-1', name: 'Cooling', depth: 1, productCount: 4210, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-3-2', name: 'Fans', depth: 1, productCount: 2860, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-3-3', name: 'Air Purifiers', depth: 1, productCount: 0, commissionRate: null, status: REVIEW_STATUS.SUBMITTED },
      { id: 'cat-4', name: 'Grocery & Staples', depth: 0, productCount: 14820, commissionRate: 6, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-4-1', name: 'Edible Oil', depth: 1, productCount: 1840, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-4-2', name: 'Spices', depth: 1, productCount: 3260, commissionRate: null, status: REVIEW_STATUS.APPROVED },
      { id: 'cat-5', name: 'Home Décor', depth: 0, productCount: 11110, commissionRate: 15, status: REVIEW_STATUS.APPROVED },
]

const INVENTORY = [
  { id: 'inv-1', name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L', sku: 'KZ-HK-STL-1200', bucket: 'own_stock', owner: 'Bhiwandi warehouse', onHand: 1840, reserved: 126, available: 1714, daysCover: 42 },
  { id: 'inv-2', name: 'Aarohi Cotton Table Runner, 180 cm', sku: 'KZ-HD-RNR-180', bucket: 'vendor', owner: 'Nova Retail Pvt Ltd', onHand: 620, reserved: 44, available: 576, daysCover: 28 },
  { id: 'inv-3', name: 'Vayu 1.5 Ton 3-Star Inverter AC', sku: 'KZ-EL-AC-1503', bucket: 'vendor', owner: 'Arya Manufacturing', onHand: 82, reserved: 12, available: 70, daysCover: 14 },
  { id: 'inv-4', name: 'Nirvaan Silicone Spatula Set of 3', sku: 'KZ-HK-SPT-003', bucket: 'own_stock', owner: 'Bhiwandi warehouse', onHand: 42, reserved: 8, available: 34, daysCover: 3 },
  { id: 'inv-5', name: 'Aarohi Jute Storage Basket, Large', sku: 'KZ-HD-BSK-LG', bucket: 'vendor', owner: 'Nova Retail Pvt Ltd', onHand: 18, reserved: 6, available: 12, daysCover: 2 },
  { id: 'inv-6', name: 'Surya Turmeric Powder, 500 g', sku: 'KZ-GR-TUR-500', bucket: 'own_stock', owner: 'Hosur warehouse', onHand: 240, reserved: 20, available: 220, daysCover: 8 },
  { id: 'inv-7', name: 'Meher Silk Blend Dupatta', sku: 'KZ-AP-DUP-S', bucket: 'vendor', owner: 'Bharat Textiles LLP', onHand: 0, reserved: 0, available: 0, daysCover: null },
  { id: 'inv-8', name: 'Vayu Ceiling Fan 1200 mm, BLDC', sku: 'KZ-EL-FAN-1200', bucket: 'vendor', owner: 'Arya Manufacturing', onHand: 96, reserved: 14, available: 82, daysCover: 6 },
]

const INVENTORY_TABS = {
  all: () => true,
  own_stock: (i) => i.bucket === 'own_stock',
  vendor: (i) => i.bucket === 'vendor',
  low: (i) => i.daysCover !== null && i.daysCover <= 7,
  out: (i) => i.onHand === 0,
}

export function inventoryFixture({ tab = 'all', filters = {} } = {}) {
  const term = (filters.search || '').trim().toLowerCase()
  let rows = INVENTORY.filter(INVENTORY_TABS[tab] || INVENTORY_TABS.all)
  if (term) {
    rows = rows.filter(
      (i) => i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term),
    )
  }
  return {
    items: rows,
    tabCounts: Object.fromEntries(
      Object.entries(INVENTORY_TABS).map(([tab, m]) => [tab, INVENTORY.filter(m).length]),
    ),
  }
}

// ---------------------------------------------------------------------------
// Writes
//
// Approval is the load-bearing one: a product sitting under a category that
// has not itself been approved cannot go live, so the queue refuses to let it
// through rather than leaving a listing pointing at a category that does not
// exist yet.
// ---------------------------------------------------------------------------

/**
 * Approve one queue item. Approving a category unblocks anything that was
 * waiting on it, which is why this walks the rest of the queue afterwards.
 */
export function approveQueueItemFixture(id) {
  const item = findOr404(APPROVALS, id)
  if (item.blockedBy) throw invalid(`${item.blockedBy} has to be approved first.`)

  drop(APPROVALS, id)

  if (item.kind === 'category') {
    for (const pending of APPROVALS) {
      if (pending.blockedBy === 'Category approval' && pending.context === item.name) {
        pending.blockedBy = null
      }
    }
    const leaf = item.name.split('›').pop().trim()
    const node = CATEGORIES.find((entry) => entry.name === item.name || entry.name === leaf)
    if (node) node.status = REVIEW_STATUS.APPROVED
  }

  if (item.kind === 'product') {
    const product = PRODUCTS.find((entry) => entry.name === item.name)
    if (product) product.status = REVIEW_STATUS.APPROVED
  }

  return { id, kind: item.kind, name: item.name }
}

export function rejectQueueItemFixture(id, { reason } = {}) {
  const item = findOr404(APPROVALS, id)
  if (!reason || reason.trim().length < 5) {
    throw invalid('Say why it was rejected — the submitter sees this.')
  }

  drop(APPROVALS, id)

  if (item.kind === 'product') {
    const product = PRODUCTS.find((entry) => entry.name === item.name)
    if (product) product.status = REVIEW_STATUS.REJECTED
  }

  return { id, kind: item.kind, name: item.name }
}

/** A stock correction. `available` is on-hand less what carts have reserved. */
export function adjustInventoryFixture(id, { onHand, reason } = {}) {
  const row = findOr404(INVENTORY, id)
  const next = Math.round(Number(onHand))

  if (!Number.isFinite(next) || next < 0) throw invalid('On-hand cannot be negative.')
  if (next < row.reserved) {
    throw invalid(`${row.reserved} units are already reserved by open carts.`)
  }
  if (!reason || reason.trim().length < 3) throw invalid('Say why the count changed.')

  row.onHand = next
  row.available = next - row.reserved
  row.lastAdjustment = reason.trim()
  return row
}
