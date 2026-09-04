import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useCampaignListController,
  useCouponListController,
  useReviewListController,
} from '../../controllers/useMarketingController'
import * as columns from '../../tableColumns/marketingColumns'

export function CouponsPage() {
  const list = useCouponListController()
  const exhausted = list.items.filter((row) => row.status === 'exhausted').length

  return (
    <ListScreen
      title="Coupons"
      description="Codes buyers type at checkout, and how much of each allowance is left."
      actions={
        <>
          <ExportMenu onExport={() => {}} />
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
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
      columns={columns.COUPON_COLUMNS}
      filters={columns.COUPON_FILTERS}
      tabs={columns.COUPON_TABS}
      searchPlaceholder="Code or description…"
      itemLabel="coupons"
      emptyIcon="marketing"
      emptyTitle="No coupons in this view"
    />
  )
}

export function CampaignsPage() {
  const list = useCampaignListController()
  const failed = list.tabCounts.failed || 0

  return (
    <ListScreen
      title="Notification campaigns"
      description="Push, SMS and email sends, their audience and what actually got delivered."
      actions={
        <>
          <ExportMenu onExport={() => {}} />
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
              New campaign
            </Button>
          </PermissionGate>
        </>
      }
      banner={
        failed > 0 && (
          <InlineAlert tone="danger" title={`${failed} campaigns failed to send`}>
            An SMS campaign fails when its template has no approved DLT registration. Check the
            template before resending — the gateway rejects the whole batch, not individual
            messages.
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
