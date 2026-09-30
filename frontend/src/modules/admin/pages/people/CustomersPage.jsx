import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { CustomerFormModal } from '../../components/people/CustomerFormModal'
import { useCustomerListController, useCustomerWriteController } from '../../controllers/usePeopleController'
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_TABS,
  getCustomerActionColumn,
} from '../../tableColumns/peopleColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

export function CustomersPage() {
  const list = useCustomerListController()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const write = useCustomerWriteController({ onSaved: () => setIsModalOpen(false) })

  const columns = [
    ...CUSTOMER_COLUMNS,
    getCustomerActionColumn((row) =>
      write.updateStatus.run({ id: row.id, isActive: row.status === 'blocked' }),
    ),
  ]

  return (
    <>
      <ListScreen
        title="Customers"
        description="Retail buyers and B2B accounts. A B2B account resolves a different price tier at checkout."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('customers.csv', CUSTOMER_COLUMNS, list.items)} />
            <Button size="control" icon="add" onClick={() => setIsModalOpen(true)}>
              Add customer
            </Button>
          </>
        }
        controller={list}
        columns={columns}
        tabs={CUSTOMER_TABS}
        searchPlaceholder="Name, email, phone or city…"
        selectable
        bulkLabel="customers selected"
        bulkActions={[
          {
            label: 'Export selected',
            icon: 'download',
            onClick: () =>
              downloadTableCsv(
                'customers-selected.csv',
                CUSTOMER_COLUMNS,
                list.items.filter((row) => list.selectedKeys.includes(row.id)),
              ),
          },
        ]}
        itemLabel="customers"
        emptyIcon="customers"
        emptyTitle="No customers match these filters"
      />

      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(values) => write.create.run(values)}
        isSubmitting={write.create.isSubmitting}
        error={write.create.error}
      />
    </>
  )
}
