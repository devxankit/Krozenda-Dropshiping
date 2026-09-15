import { ListScreen } from '../../admin/components/data'
import { useVendorCustomersController } from '../controllers/useVendorController'
import { VENDOR_CUSTOMER_COLUMNS } from '../tableColumns/vendorColumns'

export function CustomersPage() {
  const controller = useVendorCustomersController()

  return (
    <ListScreen
      title="Customers"
      description="Buyers who have purchased your products."
      controller={controller}
      columns={VENDOR_CUSTOMER_COLUMNS}
      searchPlaceholder="Name, phone or email…"
      itemLabel="customers"
      emptyIcon="customers"
      emptyTitle="No customers yet"
      emptyDescription="Customers who buy your products will show up here."
    />
  )
}
