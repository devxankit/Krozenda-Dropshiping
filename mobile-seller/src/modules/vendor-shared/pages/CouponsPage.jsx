import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '../../../components/ui'
import { ExportMenu, ListScreen } from '../../../components/admin/data'
import { InlineAlert } from '../../../components/admin/feedback'
import { ConfirmDialog } from '../../../components/admin/overlay/ConfirmDialog'
import { toast } from '../../../lib/toast'
import { useVendorCouponsController } from '../controllers/useVendorController'
import { VendorCouponFormDrawer } from '../components/marketing/VendorCouponFormDrawer'
import { VENDOR_COUPON_COLUMNS, VENDOR_COUPON_TABS } from '../tableColumns/miscColumns'
import { downloadTableCsv } from '../../../lib/exportCsv'

// Mirrors admin's Coupons screen (ListScreen + FormDrawer, same banner/tabs/
// actions pattern) — scoped to coupons this seller created for their own
// products only (see VendorCouponFormDrawer and backend vendorCouponController).
export function CouponsPage() {
  const list = useVendorCouponsController()
  const exhausted = list.tabCounts?.usage_limit_reached || 0

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [removingCoupon, setRemovingCoupon] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <Button
            size="xs"
            variant="secondary"
            disabled={togglingId === row.id}
            onClick={async () => {
              setTogglingId(row.id)
              try {
                await list.toggleStatus(row.id, !row.isActive)
                toast.success(row.isActive ? 'Coupon deactivated' : 'Coupon activated')
              } catch (err) {
                toast.error('Could not update coupon', err?.response?.data?.message || 'Something went wrong')
              } finally {
                setTogglingId(null)
              }
            }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setRemovingCoupon(row)}>
            Delete
          </Button>
        </View>
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
          exhausted > 0 ? (
            <InlineAlert tone="warning" title={`${exhausted} coupons have hit their usage limit`}>
              An exhausted code still validates but no longer discounts. Raise the limit or let it expire.
            </InlineAlert>
          ) : null
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
        isSubmitting={isDeleting}
        onConfirm={async () => {
          setIsDeleting(true)
          try {
            await list.deleteCoupon(removingCoupon.id)
            toast.success('Coupon deleted')
          } catch (err) {
            toast.error('Could not delete coupon', err?.response?.data?.message || 'Something went wrong')
          }
          setIsDeleting(false)
          setRemovingCoupon(null)
        }}
      />
    </>
  )
}
