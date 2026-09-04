import { Badge, Icon } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

const COUPON_STATUS_LABELS = Object.freeze({
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  expired: 'Expired',
  exhausted: 'Exhausted',
})
const COUPON_STATUS_TONE = Object.freeze({
  scheduled: 'brand',
  active: 'success',
  paused: 'warning',
  expired: 'neutral',
  exhausted: 'neutral',
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

const REVIEW_STATUS_LABELS = Object.freeze({
  pending: 'Awaiting moderation',
  published: 'Published',
  rejected: 'Rejected',
})
const REVIEW_STATUS_TONE = Object.freeze({
  pending: 'warning',
  published: 'success',
  rejected: 'danger',
})

const CHANNEL_ICON = Object.freeze({ push: 'notifications', sms: 'phone', email: 'mail' })

function discountLabel(row) {
  if (row.discountType === 'shipping') return 'Free shipping'
  if (row.discountType === 'percentage') return `${row.discountValue}% off`
  return `₹${(row.discountValue / 100).toLocaleString('en-IN')} off`
}

export const COUPON_COLUMNS = Object.freeze([
  {
    key: 'code',
    header: 'Code',
    width: '12rem',
    render: (row) => (
      <span className="block min-w-0">
        <span className="tabular block font-semibold text-slate-900">{row.code}</span>
        <span className="block truncate text-2xs text-ink-faint">{row.description}</span>
      </span>
    ),
  },
  {
    key: 'discountValue',
    header: 'Discount',
    width: '8rem',
    render: (row) => (
      <span className="text-xs font-medium text-slate-800">{discountLabel(row)}</span>
    ),
  },
  {
    key: 'minCartValue',
    header: 'Minimum cart',
    width: '8rem',
    align: 'right',
    render: (row) =>
      row.minCartValue ? <MoneyCell amount={row.minCartValue} muted /> : <span className="text-2xs text-ink-faint">none</span>,
  },
  {
    key: 'used',
    header: 'Redeemed',
    width: '9rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className="flex flex-col items-end gap-0.5">
        <span className="tabular text-xs font-semibold text-slate-900">
          {row.used.toLocaleString('en-IN')}
          {row.usageLimit ? ` / ${row.usageLimit.toLocaleString('en-IN')}` : ''}
        </span>
        {row.usageLimit && (
          <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-sunken">
            <span
              className={`block h-1 rounded-full ${row.used >= row.usageLimit ? 'bg-danger-500' : 'bg-brand-600'}`}
              style={{ width: `${Math.min(100, (row.used / row.usageLimit) * 100)}%` }}
            />
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'endsOn',
    header: 'Runs',
    width: '11rem',
    render: (row) => (
      <span className="text-2xs text-ink-muted">
        {row.startsOn} → {row.endsOn}
      </span>
    ),
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
      { value: 'percentage', label: 'Percentage' },
      { value: 'fixed', label: 'Fixed amount' },
      { value: 'shipping', label: 'Free shipping' },
    ],
  },
])

export const COUPON_TABS = Object.freeze([
  { id: 'all', label: 'All coupons' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'paused', label: 'Paused' },
  { id: 'finished', label: 'Finished' },
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
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          name="star"
          className={`h-3 w-3 ${star <= rating ? 'text-warning-500' : 'text-border-strong'}`}
        />
      ))}
    </span>
  )
}

export const REVIEW_COLUMNS = Object.freeze([
  {
    key: 'rating',
    header: 'Rating',
    width: '6.5rem',
    render: (row) => <Stars rating={row.rating} />,
  },
  {
    key: 'title',
    header: 'Review',
    render: (row) => (
      <span className="block min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-slate-900">{row.title}</span>
          {row.flagged && (
            <Badge tone="danger" size="sm" dot>
              Flagged
            </Badge>
          )}
        </span>
        <span className="block truncate text-2xs text-ink-faint">{row.body}</span>
      </span>
    ),
  },
  {
    key: 'product',
    header: 'Product',
    width: '14rem',
    render: (row) => (
      <PrimaryCell title={row.product} subtitle={row.sku} to={adminPath.productDetail('prd-1')} />
    ),
  },
  {
    key: 'buyer',
    header: 'Buyer',
    width: '10rem',
    render: (row) => (
      <span className="block">
        <span className="block truncate text-xs text-ink-muted">{row.buyer}</span>
        {row.verifiedPurchase ? (
          <span className="text-2xs text-success-700">Verified purchase</span>
        ) : (
          <span className="text-2xs text-danger-700">Not a verified purchase</span>
        )}
      </span>
    ),
  },
  { key: 'submittedAt', header: 'Submitted', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'status',
    header: 'Status',
    width: '10.5rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={REVIEW_STATUS_LABELS}
        tones={REVIEW_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

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
  { id: 'pending', label: 'Awaiting moderation' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'published', label: 'Published' },
  { id: 'rejected', label: 'Rejected' },
])

const BANNER_TONE = Object.freeze({
  live: 'success',
  scheduled: 'brand',
  ended: 'neutral',
  draft: 'neutral',
})
const CMS_TONE = Object.freeze({ published: 'success', draft: 'warning', archived: 'neutral' })

export const BANNER_COLUMNS = Object.freeze([
  {
    key: 'title',
    header: 'Banner',
    render: (row) => (
      <span className="block min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-900">{row.title}</span>
        <span className="block text-2xs text-ink-faint">
          {row.placement} · {row.audience}
        </span>
      </span>
    ),
  },
  {
    key: 'startsOn',
    header: 'Runs',
    width: '11rem',
    render: (row) =>
      row.startsOn ? (
        <span className="text-2xs text-ink-muted">
          {row.startsOn} → {row.endsOn}
        </span>
      ) : (
        <span className="text-2xs text-ink-faint">not scheduled</span>
      ),
  },
  { key: 'priority', header: 'Priority', width: '6rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'clicks',
    header: 'Clicks / impressions',
    width: '11rem',
    align: 'right',
    render: (row) =>
      row.impressions ? (
        <span className="tabular text-xs text-ink-muted">
          {row.clicks.toLocaleString('en-IN')} / {row.impressions.toLocaleString('en-IN')}
          <span className="ml-1.5 font-semibold text-slate-900">
            {((row.clicks / row.impressions) * 100).toFixed(1)}%
          </span>
        </span>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={BANNER_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])

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
