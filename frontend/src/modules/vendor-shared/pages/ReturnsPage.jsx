import { useState } from 'react'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { DataTable } from '../../admin/components/data/DataTable'
import { useVendorReturnsController } from '../controllers/useVendorController'
import { VENDOR_RETURN_COLUMNS } from '../tableColumns/vendorColumns'
import { VendorReturnDrawer } from '../components/modals/VendorReturnDrawer'

export function ReturnsPage() {
  const controller = useVendorReturnsController()
  const [selected, setSelected] = useState(null)

  // Kept in sync with the freshly fetched list rather than held as a snapshot:
  // after a recommendation the controller refetches, and a stale copy would
  // still show the old "Send recommendation" state.
  const openRequest = selected ? controller.items.find((r) => r.id === selected) ?? null : null

  return (
    <PageBody>
      <PageHeader
        title="Returns & Refunds"
        description="Return and replacement requests raised against your products. You can recommend an outcome; an admin makes the final decision."
      />
      <DataTable
        columns={VENDOR_RETURN_COLUMNS}
        data={controller.items}
        getRowKey={(row) => row.id}
        isLoading={controller.isLoading}
        onRowClick={(row) => setSelected(row.id)}
        emptyTitle="No return requests"
        emptyDescription="Return and refund requests for your products will show up here."
      />

      <VendorReturnDrawer
        // Remount per request — see the note on VendorReturnDrawer.
        key={openRequest?.id}
        request={openRequest}
        isOpen={Boolean(openRequest)}
        onClose={() => setSelected(null)}
        controller={controller}
      />
    </PageBody>
  )
}
