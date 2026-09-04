import { ExportMenu, ListScreen } from '../../components/data'
import { useCustomerListController } from '../../controllers/usePeopleController'
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_FILTERS,
  CUSTOMER_TABS,
} from '../../tableColumns/peopleColumns'

export function CustomersPage() {
  const list = useCustomerListController()

  return (
    <ListScreen
      title="Customers"
      description="Retail buyers and B2B accounts. A B2B account resolves a different price tier at checkout."
      actions={<ExportMenu onExport={() => {}} />}
      controller={list}
      columns={CUSTOMER_COLUMNS}
      filters={CUSTOMER_FILTERS}
      tabs={CUSTOMER_TABS}
      searchPlaceholder="Name, email, phone or city…"
      selectable
      bulkLabel="customers selected"
      bulkActions={[
        { label: 'Send campaign', icon: 'campaigns', onClick: () => {} },
        { label: 'Export selected', icon: 'download', onClick: () => {} },
        { label: 'Block', icon: 'lock', tone: 'danger', onClick: () => {} },
      ]}
      itemLabel="customers"
      emptyIcon="customers"
      emptyTitle="No customers match these filters"
    />
  )
}
