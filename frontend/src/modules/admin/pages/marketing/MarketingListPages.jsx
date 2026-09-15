import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { CampaignFormModal } from '../../components/marketing/CampaignFormModal'
import { CouponFormDrawer } from '../../components/marketing/CouponFormDrawer'
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

export function CouponsPage() {
  const list = useCouponListController()
  const exhausted = list.items.filter((row) => row.status === 'USAGE_LIMIT_REACHED').length

  const [editingCoupon, setEditingCoupon] = useState(null)
  const [removingCoupon, setRemovingCoupon] = useState(null)
  const writer = useCouponWriteController({ onSaved: () => setEditingCoupon(null) })

  const couponColumns = [
    ...columns.COUPON_COLUMNS,
    {
      key: '__actions',
      header: '',
      width: '11rem',
      align: 'right',
      render: (row) => (
        <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="secondary" onClick={() => writer.setStatus.run({ id: row.id, isActive: !row.isActive })}>
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditingCoupon(row)}>
              Edit
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setRemovingCoupon(row)}>
              Delete
            </Button>
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
            <ExportMenu onExport={() => {}} />
            <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
              <Button size="control" icon="add" onClick={() => setEditingCoupon('new')}>
                New coupon
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          exhausted > 0 && (
            <InlineAlert tone="warning" title={`${exhausted} coupons have hit their usage limit`}>
              An exhausted code still validates but no longer discounts. Raise the limit or let it
              expire — leaving it live confuses buyers who saw it advertised.
            </InlineAlert>
          )
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
            <ExportMenu onExport={() => {}} />
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
  const flagged = list.tabCounts.flagged || 0

  return (
    <ListScreen
      title="Review moderation"
      description="Ratings and reviews waiting on a decision before they appear on the storefront."
      actions={<ExportMenu onExport={() => {}} />}
      banner={
        flagged > 0 && (
          <InlineAlert tone="danger" title={`${flagged} reviews are flagged`}>
            Flagged reviews contain contact details, abuse, or come from an account with no
            verified purchase of the product.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns.REVIEW_COLUMNS}
      filters={columns.REVIEW_FILTERS}
      tabs={columns.REVIEW_TABS}
      searchPlaceholder="Product, SKU, buyer or title…"
      selectable
      bulkLabel="reviews selected"
      bulkActions={[
        { label: 'Publish', icon: 'check', onClick: () => {} },
        { label: 'Reject', icon: 'close', tone: 'danger', onClick: () => {} },
      ]}
      itemLabel="reviews"
      emptyIcon="reviews"
      emptyTitle="No reviews in this view"
    />
  )
}
