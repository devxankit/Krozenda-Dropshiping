import { DateCell, PrimaryCell, StatusPill } from '../components/display'
import {
  CJ_ORDER_STATUS_TONE,
  CJ_SHIPMENT_STATUS_TONE,
  CJ_DISPUTE_STATUS_TONE,
  CJ_SYNC_STATUS_TONE,
} from '../constants'

// CJ's category tree is 3 levels deep — verified against a live account:
// [{ categoryFirstId, categoryFirstName, categoryFirstList: [{ categorySecondId,
// categorySecondName, categorySecondList: [{ categoryId, categoryName }] }] }].
// Only the leaf (`categoryId`/`categoryName`) is what a product's own
// `categoryId` field actually matches, so this is what the catalogue's
// category filter and the onboarding category-mapping picker both need —
// a flat list of leaves, not the raw tree.
export function flattenCjCategories(tree) {
  const leaves = []
  for (const first of tree || []) {
    for (const second of first.categoryFirstList || []) {
      for (const leaf of second.categorySecondList || []) {
        leaves.push({
          value: leaf.categoryId,
          label: `${first.categoryFirstName} > ${second.categorySecondName} > ${leaf.categoryName}`,
        })
      }
    }
  }
  return leaves
}

// Approximate, display-only USD->INR rate. This is NOT what the pricing
// engine uses to compute a selling price (that's backend/services/cj's own
// rate, kept in sync with this — see cjPricing.js) — it only decides what
// number a rupee-preferring admin sees while browsing CJ's catalogue, where
// every price CJ quotes is in USD.
export const USD_TO_INR_RATE = 87

// CJ sometimes quotes a price as a range string ("5.00-8.00") rather than a
// single number — a plain Number() on that is NaN, which is the blank/"$NaN"
// card bug. This takes the low end of a range (the honest floor of what the
// product could cost) and returns 0 for anything unparseable, never NaN.
export function parseCjPrice(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'string') return 0
  const match = raw.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

// Catalogue browsing display: CJ's raw USD price (or range), shown as an
// approximate ₹ figure so the admin isn't reading dollars while pricing an
// Indian storefront. The ACTUAL selling price stored on a Product is
// computed server-side by cjOnboardingService — this is just what the
// browse card shows before that decision is made.
export function catalogPriceInr(raw) {
  const usd = parseCjPrice(raw)
  const inr = usd * USD_TO_INR_RATE
  return `₹${inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function money(amount, currency = 'USD') {
  if (typeof amount !== 'number') return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export const CJ_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'product',
    header: 'Product',
    render: (row) => (
      <PrimaryCell title={row.product?.name || row.cjProductName || row.cjProductId} subtitle={`CJ #${row.cjProductId}`} />
    ),
  },
  {
    key: 'category',
    header: 'Category',
    width: '9rem',
    render: (row) => row.product?.category?.name || '—',
  },
  {
    key: 'pricingMode',
    header: 'Pricing',
    width: '7rem',
    render: (row) => <StatusPill status={row.pricingMode} tones={{ MANUAL: 'neutral', AUTOMATIC: 'brand' }} />,
  },
  {
    key: 'price',
    header: 'Selling price',
    width: '7rem',
    align: 'right',
    render: (row) => (row.product?.price != null ? `₹${row.product.price.toLocaleString('en-IN')}` : '—'),
  },
  {
    key: 'stock',
    header: 'Stock',
    width: '6rem',
    align: 'right',
    render: (row) => row.product?.stock ?? '—',
  },
  {
    key: 'syncStatus',
    header: 'Sync status',
    width: '8rem',
    render: (row) => <StatusPill status={row.syncStatus} tones={{ IDLE: 'success', SYNCING: 'brand', FAILED: 'danger' }} />,
  },
  {
    key: 'lastSyncedAt',
    header: 'Last synced',
    width: '9rem',
    render: (row) => (row.lastSyncedAt ? <DateCell value={row.lastSyncedAt} /> : '—'),
  },
])

export const CJ_ORDER_COLUMNS = Object.freeze([
  {
    key: 'cjOrderId',
    header: 'CJ Order',
    render: (row) => (
      <PrimaryCell title={row.cjOrderId || row.cjOrderNumber || 'Pending creation'} subtitle={`Sub-order: ${row.krozendaSubOrderId}`} />
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => <StatusPill status={row.status} tones={CJ_ORDER_STATUS_TONE} />,
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    width: '7rem',
    render: (row) => <StatusPill status={row.paymentStatus} tones={{ PENDING: 'neutral', PAID: 'success', FAILED: 'danger' }} />,
  },
  {
    key: 'totalCost',
    header: 'Cost',
    width: '7rem',
    align: 'right',
    render: (row) => money(row.totalCost, row.currency),
  },
  {
    key: 'createdAt',
    header: 'Created',
    width: '9rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const CJ_SHIPMENT_COLUMNS = Object.freeze([
  {
    key: 'trackingNumber',
    header: 'Tracking',
    render: (row) => <PrimaryCell title={row.trackingNumber || 'Not yet assigned'} subtitle={row.carrier || '—'} />,
  },
  {
    key: 'cjOrderId',
    header: 'CJ Order',
    width: '10rem',
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => <StatusPill status={row.status} tones={CJ_SHIPMENT_STATUS_TONE} />,
  },
  {
    key: 'lastSyncedAt',
    header: 'Last synced',
    width: '9rem',
    render: (row) => (row.lastSyncedAt ? <DateCell value={row.lastSyncedAt} /> : 'Never'),
  },
])

export const CJ_DISPUTE_COLUMNS = Object.freeze([
  {
    key: 'reason',
    header: 'Dispute',
    render: (row) => <PrimaryCell title={row.reason} subtitle={`CJ Order: ${row.cjOrderId}`} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => <StatusPill status={row.status} tones={CJ_DISPUTE_STATUS_TONE} />,
  },
  {
    key: 'requestedRecoveryAmount',
    header: 'Requested',
    width: '7rem',
    align: 'right',
    render: (row) => money(row.requestedRecoveryAmount),
  },
  {
    key: 'approvedRecoveryAmount',
    header: 'Approved',
    width: '7rem',
    align: 'right',
    render: (row) => (row.approvedRecoveryAmount != null ? money(row.approvedRecoveryAmount) : '—'),
  },
  {
    key: 'createdAt',
    header: 'Opened',
    width: '9rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const CJ_SYNC_LOG_COLUMNS = Object.freeze([
  {
    key: 'entity',
    header: 'Entity',
    width: '6rem',
  },
  {
    key: 'entityId',
    header: 'CJ ID',
    width: '9rem',
  },
  {
    key: 'operation',
    header: 'Operation',
    width: '8rem',
  },
  {
    key: 'trigger',
    header: 'Trigger',
    width: '7rem',
  },
  {
    key: 'status',
    header: 'Result',
    width: '7rem',
    render: (row) => <StatusPill status={row.status} tones={CJ_SYNC_STATUS_TONE} />,
  },
  {
    key: 'error',
    header: 'Error',
    render: (row) => row.error || '—',
  },
  {
    key: 'createdAt',
    header: 'When',
    width: '9rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])
