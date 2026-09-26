import { useState } from 'react'
import { Button, Icon } from '../../../../components/ui'
import { CampaignFormModal } from '../../components/marketing/CampaignFormModal'
import { CouponFormDrawer } from '../../components/marketing/CouponFormDrawer'
import { CouponWhatsappDrawer } from '../../components/marketing/CouponWhatsappDrawer'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useCampaignListController,
  useCampaignWriteController,
  useCouponListController,
  useCouponWriteController,
  useReviewListController,
} from '../../controllers/useMarketingController'
import * as columns from '../../tableColumns/marketingColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

// The summary strip above the coupon list. Each card is also a shortcut to
// its tab, so "3 exhausted" is one click away from the three codes.
const COUPON_STATS = Object.freeze([
  { tab: 'all', label: 'Total coupons', icon: 'coupons', caption: 'Every code on the platform', accent: 'slate' },
  { tab: 'active', label: 'Active', icon: 'live', caption: 'Working at checkout now', accent: 'success' },
  { tab: 'upcoming', label: 'Scheduled', icon: 'calendar', caption: 'Start date still ahead', accent: 'brand' },
  { tab: 'inactive', label: 'Paused', icon: 'pause', caption: 'Switched off by an admin', accent: 'warning' },
  { tab: 'usage_limit_reached', label: 'Exhausted', icon: 'warning', caption: 'Usage limit reached', accent: 'danger' },
  { tab: 'expired', label: 'Expired', icon: 'pending', caption: 'End date has passed', accent: 'muted' },
])

const ACCENT = Object.freeze({
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-success-50 text-success-700 ring-success-200',
  brand: 'bg-brand-50 text-brand-600 ring-brand-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200',
  muted: 'bg-surface-muted text-ink-subtle ring-border',
})

function CouponStats({ tabCounts = {}, activeTab, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {COUPON_STATS.map((stat) => {
        const selected = (activeTab || 'all') === stat.tab
        return (
          <button
            key={stat.tab}
            type="button"
            onClick={() => onSelect(stat.tab)}
            className={`group flex flex-col rounded-lg border bg-surface p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised ${
              selected ? 'border-brand-400 ring-2 ring-brand-500/20' : 'border-border'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{stat.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${ACCENT[stat.accent]}`}>
                <Icon name={stat.icon} className="h-4 w-4" />
              </span>
            </span>
            <span className="tabular mt-1 text-2xl font-bold leading-tight text-slate-900">
              {(tabCounts[stat.tab] ?? 0).toLocaleString('en-IN')}
            </span>
            <span className="mt-1 truncate text-2xs text-ink-subtle">{stat.caption}</span>
          </button>
        )
      })}
    </div>
  )
}

// Icon-only row action with a tooltip; the label still reaches screen readers.
function RowAction({ icon, label, onClick, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-ink-subtle hover:bg-danger-50 hover:text-danger-700'
      : tone === 'success'
        ? 'text-success-700 hover:bg-success-50'
        : tone === 'warning'
          ? 'text-warning-700 hover:bg-warning-50'
          : 'text-ink-subtle hover:bg-brand-50 hover:text-brand-700'
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${toneClass}`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  )
}

export function CouponsPage() {
  const list = useCouponListController()
  const exhausted = list.tabCounts?.usage_limit_reached ?? 0

  const [editingCoupon, setEditingCoupon] = useState(null)
  const [removingCoupon, setRemovingCoupon] = useState(null)
  const [whatsappCoupon, setWhatsappCoupon] = useState(null)
  const writer = useCouponWriteController({ onSaved: () => setEditingCoupon(null) })

  const couponColumns = [
    ...columns.COUPON_COLUMNS,
    {
      key: '__actions',
      header: '',
      width: '10rem',
      align: 'right',
      render: (row) => (
        <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            {(row.status === 'ACTIVE' || row.status === 'UPCOMING') && (
              <RowAction icon="message" label="Send on WhatsApp" tone="success" onClick={() => setWhatsappCoupon(row)} />
            )}
            <RowAction
              icon={row.isActive ? 'pause' : 'play'}
              label={row.isActive ? 'Pause coupon' : 'Activate coupon'}
              tone={row.isActive ? 'warning' : 'success'}
              onClick={() => writer.setStatus.run({ id: row.id, isActive: !row.isActive })}
            />
            <RowAction icon="edit" label="Edit coupon" onClick={() => setEditingCoupon(row)} />
            <RowAction icon="delete" label="Delete coupon" tone="danger" onClick={() => setRemovingCoupon(row)} />
          </div>
        </PermissionGate>
      ),
    },
  ]

  return (
    <>
      <ListScreen
        title="Coupons"
        description="Codes buyers type at checkout, and how much of each allowance is left."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('coupons.csv', columns.COUPON_COLUMNS, list.items)} />
            <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
              <Button size="control" icon="add" onClick={() => setEditingCoupon('new')}>
                New coupon
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          <div className="flex flex-col gap-3">
            <CouponStats tabCounts={list.tabCounts} activeTab={list.tab} onSelect={list.changeTab} />
            {exhausted > 0 && (
              <InlineAlert
                tone="warning"
                title={`${exhausted} coupon${exhausted === 1 ? ' has' : 's have'} hit the usage limit`}
              >
                An exhausted code still validates but no longer discounts. Raise the limit or let it
                expire — leaving it live confuses buyers who saw it advertised.
              </InlineAlert>
            )}
          </div>
        }
        controller={list}
        columns={couponColumns}
        filters={columns.COUPON_FILTERS}
        tabs={columns.COUPON_TABS}
        searchPlaceholder="Code or description…"
        itemLabel="coupons"
        emptyIcon="marketing"
        emptyTitle="No coupons in this view"
      />

      {editingCoupon && (
        <CouponFormDrawer
          key={editingCoupon === 'new' ? 'new-coupon' : editingCoupon.id}
          isOpen
          onClose={() => setEditingCoupon(null)}
          coupon={editingCoupon === 'new' ? null : editingCoupon}
          writer={writer}
        />
      )}

      {whatsappCoupon && (
        <CouponWhatsappDrawer key={whatsappCoupon.id} coupon={whatsappCoupon} onClose={() => setWhatsappCoupon(null)} />
      )}

      <ConfirmDialog
        isOpen={Boolean(removingCoupon)}
        onClose={() => setRemovingCoupon(null)}
        title={`Delete coupon: "${removingCoupon?.code}"?`}
        description="This coupon will stop working immediately. Past redemptions are unaffected."
        confirmLabel="Delete coupon"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removingCoupon.id })
          setRemovingCoupon(null)
        }}
      />
    </>
  )
}

export function CampaignsPage() {
  const list = useCampaignListController()
  const failed = list.tabCounts.failed || 0

  const [isModalOpen, setIsModalOpen] = useState(false)
  const write = useCampaignWriteController({ onSaved: () => setIsModalOpen(false) })

  return (
    <>
      <ListScreen
        title="Notification campaigns"
        description="Push notifications sent from here go out live via Firebase Cloud Messaging to every device registered for the chosen audience."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('campaigns.csv', columns.CAMPAIGN_COLUMNS, list.items)} />
            <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
              <Button size="control" icon="add" onClick={() => setIsModalOpen(true)}>
                New campaign
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          failed > 0 && (
            <InlineAlert tone="danger" title={`${failed} campaigns failed to send`}>
              A push campaign fails when none of the target audience has push notifications
              enabled on a registered device.
            </InlineAlert>
          )
        }
        controller={list}
        columns={columns.CAMPAIGN_COLUMNS}
        filters={columns.CAMPAIGN_FILTERS}
        tabs={columns.CAMPAIGN_TABS}
        searchPlaceholder="Campaign name or audience…"
        itemLabel="campaigns"
        emptyIcon="campaigns"
        emptyTitle="No campaigns in this view"
      />

      <CampaignFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(values) => write.send.run(values)}
        isSubmitting={write.send.isSubmitting}
        error={write.send.error}
      />
    </>
  )
}

export function ReviewsPage() {
  const list = useReviewListController()

  return (
    <ListScreen
      title="Product reviews"
      description="Ratings and reviews across admin, vendor and dropshipping products."
      actions={<ExportMenu onExport={() => downloadTableCsv('reviews.csv', columns.REVIEW_COLUMNS, list.items)} />}
      controller={list}
      columns={columns.REVIEW_COLUMNS}
      filters={columns.REVIEW_FILTERS}
      tabs={columns.REVIEW_TABS}
      searchPlaceholder="Product, SKU, buyer or title…"
      itemLabel="reviews"
      emptyIcon="reviews"
      emptyTitle="No reviews in this view"
    />
  )
}
