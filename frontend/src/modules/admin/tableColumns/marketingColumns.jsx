import { Badge, Icon } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { MoneyCell, PrimaryCell, StatusPill } from '../components/display'
import { CopyCodeButton } from '../components/marketing/CopyCodeButton'

// Rule 07: column definitions and filter schemas are DATA.

const COUPON_STATUS_LABELS = Object.freeze({
  UPCOMING: 'Scheduled',
  ACTIVE: 'Active',
  INACTIVE: 'Paused',
  EXPIRED: 'Expired',
  USAGE_LIMIT_REACHED: 'Exhausted',
})
const COUPON_STATUS_TONE = Object.freeze({
  UPCOMING: 'brand',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  EXPIRED: 'neutral',
  USAGE_LIMIT_REACHED: 'neutral',
})

const CAMPAIGN_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
})
const CAMPAIGN_STATUS_TONE = Object.freeze({
  draft: 'neutral',
  scheduled: 'brand',
  sending: 'brand',
  sent: 'success',
  failed: 'danger',
})

const CHANNEL_ICON = Object.freeze({ push: 'notifications', sms: 'phone', email: 'mail' })

function discountLabel(row) {
  if (row.discountType === 'PERCENTAGE') return `${row.discountValue}% off`
  return `₹${(row.discountValue / 100).toLocaleString('en-IN')} off`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SCOPE_LABEL = Object.freeze({
  PRODUCTS: ['product', 'products'],
  CATEGORIES: ['category', 'categories'],
  VENDORS: ['seller', 'sellers'],
})

const ELIGIBILITY_LABEL = Object.freeze({
  NEW: 'New customers',
  EXISTING: 'Returning customers',
  SPECIFIC: 'Selected customers',
})

// "All products", or "3 categories" — what the code can be spent on.
function scopeLabel(row) {
  const words = SCOPE_LABEL[row.applicableTo]
  if (!words) return 'All products'
  const count = { PRODUCTS: row.productIds, CATEGORIES: row.categoryIds, VENDORS: row.vendorIds }[row.applicableTo]
    ?.length
  return `${count} ${count === 1 ? words[0] : words[1]}`
}

const DAY_MS = 24 * 60 * 60 * 1000

// A plain-language hint under the dates: how long is left, or how long ago.
function runHint(row) {
  const now = Date.now()
  const start = new Date(row.startDate).getTime()
  const end = new Date(row.endDate).getTime()
  const days = (ms) => Math.max(1, Math.ceil(ms / DAY_MS))
  if (start > now) return { text: `Starts in ${days(start - now)}d`, tone: 'text-brand-700' }
  if (end < now) return { text: `Ended ${days(now - end)}d ago`, tone: 'text-ink-faint' }
  const left = days(end - now)
  return { text: `${left}d left`, tone: left <= 3 ? 'text-warning-700 font-semibold' : 'text-success-700' }
}

export const COUPON_COLUMNS = Object.freeze([
  {
    key: 'code',
    header: 'Coupon',
    width: '16rem',
    render: (row) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
            row.status === 'ACTIVE'
              ? 'bg-brand-50 text-brand-600 ring-brand-100'
              : 'bg-surface-muted text-ink-faint ring-border'
          }`}
        >
          <Icon name="coupons" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="rounded-md border border-dashed border-brand-300 bg-brand-50/60 px-1.5 py-0.5 font-mono text-xs font-bold tracking-wide text-brand-800">
              {row.code}
            </span>
            <CopyCodeButton code={row.code} />
          </span>
          <span className="mt-0.5 block truncate text-2xs text-ink-subtle" title={row.description}>
            {row.description || 'No description'}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: 'discountValue',
    header: 'Discount',
    width: '11rem',
    render: (row) => (
      <span className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-bold text-success-700 ring-1 ring-success-200">
          <Icon name={row.discountType === 'PERCENTAGE' ? 'percent' : 'money'} className="h-3 w-3" />
          {discountLabel(row)}
        </span>
        <span className="flex items-center gap-1 text-2xs text-ink-subtle">
          {row.discountType === 'PERCENTAGE' && row.maxDiscountAmount
            ? `up to ₹${(row.maxDiscountAmount / 100).toLocaleString('en-IN')} · `
            : ''}
          {scopeLabel(row)}
        </span>
      </span>
    ),
  },
  {
    key: 'minOrderAmount',
    header: 'Minimum cart',
    width: '9rem',
    render: (row) => (
      <span className="flex items-center gap-1.5">
        <Icon name="cart" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        {row.minOrderAmount ? (
          <MoneyCell amount={row.minOrderAmount} />
        ) : (
          <span className="text-2xs text-ink-faint">No minimum</span>
        )}
      </span>
    ),
  },
  {
    key: 'usedCount',
    header: 'Redeemed',
    width: '10rem',
    sortable: true,
    render: (row) => {
      const pct = row.usageLimit ? Math.min(100, (row.usedCount / row.usageLimit) * 100) : 0
      const full = row.usageLimit && row.usedCount >= row.usageLimit
      return (
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Icon name="users" className="h-3.5 w-3.5 text-ink-faint" />
            <span className="tabular text-xs font-semibold text-slate-900">
              {row.usedCount.toLocaleString('en-IN')}
              <span className="font-normal text-ink-faint">
                {row.usageLimit ? ` / ${row.usageLimit.toLocaleString('en-IN')}` : ' · no limit'}
              </span>
            </span>
          </span>
          {row.usageLimit ? (
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className={`block h-1.5 rounded-full ${full ? 'bg-danger-500' : pct >= 80 ? 'bg-warning-500' : 'bg-brand-600'}`}
                style={{ width: `${pct}%` }}
              />
            </span>
          ) : null}
          <span className="text-2xs text-ink-faint">
            {row.perUserLimit ? `${row.perUserLimit} per customer` : 'Unlimited per customer'}
            {ELIGIBILITY_LABEL[row.customerEligibility] ? ` · ${ELIGIBILITY_LABEL[row.customerEligibility]}` : ''}
          </span>
        </span>
      )
    },
  },
  {
    key: 'endDate',
    header: 'Runs',
    width: '12rem',
    render: (row) => {
      const hint = runHint(row)
      return (
        <span className="flex items-start gap-1.5">
          <Icon name="calendar" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="flex flex-col">
            <span className="text-2xs text-ink-muted">
              {formatDate(row.startDate)} → {formatDate(row.endDate)}
            </span>
            <span className={`text-2xs ${hint.tone}`}>{hint.text}</span>
          </span>
        </span>
      )
    },
  },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={COUPON_STATUS_LABELS}
        tones={COUPON_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const COUPON_FILTERS = Object.freeze([
  {
    key: 'discountType',
    label: 'Discount type',
    options: [
      { value: 'PERCENTAGE', label: 'Percentage' },
      { value: 'FIXED', label: 'Fixed amount' },
    ],
  },
])

export const COUPON_TABS = Object.freeze([
  { id: 'all', label: 'All coupons' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Scheduled' },
  { id: 'inactive', label: 'Paused' },
  { id: 'expired', label: 'Expired' },
  { id: 'usage_limit_reached', label: 'Exhausted' },
])

export const CAMPAIGN_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Campaign',
    render: (row) => <PrimaryCell title={row.name} subtitle={row.audience} />,
  },
  {
    key: 'channel',
    header: 'Channel',
    width: '7.5rem',
    render: (row) => (
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon name={CHANNEL_ICON[row.channel]} className="h-3.5 w-3.5" />
        {row.channel.toUpperCase()}
      </span>
    ),
  },
  {
    key: 'audienceSize',
    header: 'Audience',
    width: '7rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">
        {row.audienceSize.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'delivered',
    header: 'Delivered',
    width: '8rem',
    align: 'right',
    render: (row) =>
      row.delivered ? (
        <span className="tabular text-xs text-slate-800">
          {row.delivered.toLocaleString('en-IN')}
          <span className="ml-1 text-2xs text-ink-faint">
            {Math.round((row.delivered / row.audienceSize) * 100)}%
          </span>
        </span>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  { key: 'sentAt', header: 'Sent', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={CAMPAIGN_STATUS_LABELS}
        tones={CAMPAIGN_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const CAMPAIGN_FILTERS = Object.freeze([
  {
    key: 'channel',
    label: 'Channel',
    options: [
      { value: 'push', label: 'Push' },
      { value: 'sms', label: 'SMS' },
      { value: 'email', label: 'Email' },
    ],
  },
])

export const CAMPAIGN_TABS = Object.freeze([
  { id: 'all', label: 'All campaigns' },
  { id: 'sent', label: 'Sent' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Draft' },
  { id: 'failed', label: 'Failed' },
])

function Stars({ rating }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${rating} out of 5`}>
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name="star"
            className={`h-3.5 w-3.5 ${star <= rating ? 'text-warning-500' : 'text-border-strong'}`}
          />
        ))}
      </span>
      <span className="text-2xs font-semibold text-ink-muted">{rating.toFixed(1)}</span>
    </span>
  )
}

function BuyerAvatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xs font-semibold text-brand-700">
      {initial}
    </span>
  )
}

export const REVIEW_COLUMNS = Object.freeze([
  {
    key: 'rating',
    header: 'Rating',
    width: '7.5rem',
    render: (row) => <Stars rating={row.rating} />,
  },
  {
    key: 'title',
    header: 'Review',
    render: (row) => (
      <span className="block min-w-0 py-0.5">
        <span className="block truncate text-xs font-semibold text-slate-900">
          {row.title || 'No title'}
        </span>
        <span className="mt-0.5 block truncate text-2xs leading-relaxed text-ink-faint">{row.body}</span>
      </span>
    ),
  },
  {
    key: 'product',
    header: 'Product',
    width: '15rem',
    render: (row) => (
      <span className="block min-w-0 space-y-1 py-0.5">
        <PrimaryCell title={row.product} subtitle={row.sku} to={adminPath.productDetail(row.productId)} />
        <Badge tone={PRODUCT_TYPE_TONE[row.productType]} size="sm" dot>
          {PRODUCT_TYPE_LABELS[row.productType]}
        </Badge>
      </span>
    ),
  },
  {
    key: 'buyer',
    header: 'Buyer',
    width: '11rem',
    render: (row) => (
      <span className="flex items-center gap-2">
        <BuyerAvatar name={row.buyer} />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-ink">{row.buyer}</span>
          {row.verifiedPurchase ? (
            <span className="flex items-center gap-1 text-2xs text-success-700">
              <Icon name="check" className="h-3 w-3" />
              Verified purchase
            </span>
          ) : (
            <span className="text-2xs text-danger-700">Not verified</span>
          )}
        </span>
      </span>
    ),
  },
  {
    key: 'submittedAt',
    header: 'Submitted',
    width: '8rem',
    cellClassName: 'text-xs text-ink-muted whitespace-nowrap',
  },
])

const PRODUCT_TYPE_LABELS = Object.freeze({ admin: 'Admin', vendor: 'Vendor', dropship: 'Dropshipping' })
const PRODUCT_TYPE_TONE = Object.freeze({ admin: 'neutral', vendor: 'brand', dropship: 'accent' })

export const REVIEW_FILTERS = Object.freeze([
  {
    key: 'rating',
    label: 'Rating',
    options: [5, 4, 3, 2, 1].map((rating) => ({
      value: String(rating),
      label: `${rating} star${rating === 1 ? '' : 's'}`,
    })),
  },
])

export const REVIEW_TABS = Object.freeze([
  { id: 'all', label: 'All reviews' },
  { id: 'admin', label: 'Admin products' },
  { id: 'vendor', label: 'Vendor products' },
  { id: 'dropship', label: 'Dropshipping products' },
])

const CMS_TONE = Object.freeze({ published: 'success', draft: 'warning', archived: 'neutral' })

export const CMS_COLUMNS = Object.freeze([
  {
    key: 'title',
    header: 'Page',
    render: (row) => (
      <span className="block min-w-0">
        <span className="block text-xs font-semibold text-slate-900">{row.title}</span>
        <span className="tabular block text-2xs text-ink-faint">/{row.slug}</span>
      </span>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    width: '6.5rem',
    render: (row) => <span className="tabular text-xs text-slate-800">{row.version}</span>,
  },
  {
    key: 'requiresAcceptance',
    header: 'Acceptance',
    width: '10rem',
    render: (row) =>
      row.requiresAcceptance ? (
        <Badge tone="accent" size="sm" dot>
          Re-acceptance on change
        </Badge>
      ) : (
        <span className="text-2xs text-ink-faint">Informational</span>
      ),
  },
  {
    key: 'updatedAt',
    header: 'Last updated',
    width: '12rem',
    render: (row) => (
      <span className="text-2xs text-ink-muted">
        {row.updatedAt} by {row.updatedBy}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={CMS_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])
