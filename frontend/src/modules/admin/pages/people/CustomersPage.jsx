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
            <ExportMenu onExport={() => {}} />
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
          { label: 'Send campaign', icon: 'campaigns', onClick: () => {} },
          { label: 'Export selected', icon: 'download', onClick: () => {} },
          { label: 'Block', icon: 'lock', tone: 'danger', onClick: () => {} },
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
