import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ExportMenu, ListScreen } from '../../admin/components/data'
import { InlineAlert } from '../../admin/components/feedback'
import { ConfirmDialog } from '../../admin/components/overlay/ConfirmDialog'
import { toast } from '../../admin/stores/toastStore'
import { useVendorCouponsController } from '../controllers/useVendorController'
import { VendorCouponFormDrawer } from '../components/marketing/VendorCouponFormDrawer'
import { VENDOR_COUPON_COLUMNS, VENDOR_COUPON_TABS } from '../tableColumns/vendorColumns'
import { downloadTableCsv } from '../../admin/lib/exportCsv'

// Mirrors admin's Coupons screen (ListScreen + FormDrawer, same banner/tabs/
// actions pattern) — scoped to coupons this seller created for their own
// products only (see VendorCouponFormDrawer and backend vendorCouponController).
export function CouponsPage() {
  const list = useVendorCouponsController()
  const exhausted = list.tabCounts?.usage_limit_reached || 0

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [removingCoupon, setRemovingCoupon] = useState(null)

  async function handleSubmit(payload) {
    try {
      await list.createCoupon(payload)
      toast.success('Coupon created', `${payload.code} is now active.`)
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Could not create coupon', err?.response?.data?.message || 'Something went wrong')
    }
  }

  const columnsWithActions = [
    ...VENDOR_COUPON_COLUMNS,
    {
      key: '__actions',
      header: '',
      width: '11rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="xs"
            variant="secondary"
            onClick={async () => {
              try {
                await list.toggleStatus(row.id, !row.isActive)
                toast.success(row.isActive ? 'Coupon deactivated' : 'Coupon activated')
              } catch (err) {
                toast.error('Could not update coupon', err?.response?.data?.message || 'Something went wrong')
              }
            }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setRemovingCoupon(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <ListScreen
        title="Coupons"
        description="Codes buyers type at checkout — scoped to your own products only."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('coupons.csv', VENDOR_COUPON_COLUMNS, list.items)} />
            <Button size="control" icon="add" onClick={() => setDrawerOpen(true)}>
              New coupon
            </Button>
          </>
        }
        banner={
          exhausted > 0 && (
            <InlineAlert tone="warning" title={`${exhausted} coupons have hit their usage limit`}>
              An exhausted code still validates but no longer discounts. Raise the limit or let it expire.
            </InlineAlert>
          )
        }
        controller={list}
        columns={columnsWithActions}
        tabs={VENDOR_COUPON_TABS}
        searchPlaceholder="Code or description…"
        itemLabel="coupons"
        emptyIcon="coupons"
        emptyTitle="No coupons yet"
        emptyDescription="Create a coupon for your products."
      />

      <VendorCouponFormDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={list.isCreating}
        error={list.createError}
      />

      <ConfirmDialog
        isOpen={Boolean(removingCoupon)}
        onClose={() => setRemovingCoupon(null)}
        title={`Delete coupon: "${removingCoupon?.code}"?`}
        description="This coupon will stop working immediately."
        confirmLabel="Delete coupon"
        tone="danger"
        onConfirm={async () => {
          try {
            await list.deleteCoupon(removingCoupon.id)
            toast.success('Coupon deleted')
          } catch (err) {
            toast.error('Could not delete coupon', err?.response?.data?.message || 'Something went wrong')
          }
          setRemovingCoupon(null)
        }}
      />
    </>
  )
}
