import { useState } from 'react'
import { Button } from '../../../../components/ui'
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

export function CouponsPage() {
  const list = useCouponListController()
  const exhausted = list.items.filter((row) => row.status === 'USAGE_LIMIT_REACHED').length

  const [editingCoupon, setEditingCoupon] = useState(null)
  const [removingCoupon, setRemovingCoupon] = useState(null)
  const [whatsappCoupon, setWhatsappCoupon] = useState(null)
  const writer = useCouponWriteController({ onSaved: () => setEditingCoupon(null) })

  const couponColumns = [
    ...columns.COUPON_COLUMNS,
    {
      key: '__actions',
      header: '',
      width: '16rem',
      align: 'right',
      render: (row) => (
        <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {(row.status === 'ACTIVE' || row.status === 'UPCOMING') && (
              <Button size="xs" variant="ghost" onClick={() => setWhatsappCoupon(row)}>
                WhatsApp
              </Button>
            )}
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
            <ExportMenu onExport={() => downloadTableCsv('coupons.csv', columns.COUPON_COLUMNS, list.items)} />
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
