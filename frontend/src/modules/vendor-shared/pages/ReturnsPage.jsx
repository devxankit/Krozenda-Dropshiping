import { PageBody, PageHeader } from '../../admin/components/shell'
import { DataTable } from '../../admin/components/data/DataTable'
import { useVendorReturnsController } from '../controllers/useVendorController'
import { VENDOR_RETURN_COLUMNS } from '../tableColumns/vendorColumns'

export function ReturnsPage() {
  const { items, isLoading } = useVendorReturnsController()

  return (
    <PageBody>
      <PageHeader
        title="Returns & Refunds"
        description="Return and replacement requests raised against your products. Admin reviews and approves each request."
      />
      <DataTable
        columns={VENDOR_RETURN_COLUMNS}
        data={items}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No return requests"
        emptyDescription="Return and refund requests for your products will show up here."
      />
    </PageBody>
  )
}
