import { useMemo, useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { AttributeFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import {
  useAttributeWriteController,
  useAttributesController,
} from '../../controllers/useCatalogController'
import { ATTRIBUTE_COLUMNS } from '../../tableColumns/catalogColumns'
import { withRowActions } from '../../tableColumns/rowActions'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE

export function AttributesPage() {
  const { data, isLoading, error, refetch } = useAttributesController()
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const writer = useAttributeWriteController({ onSaved: () => setEditing(null) })

  const columns = useMemo(
    () =>
      withRowActions(ATTRIBUTE_COLUMNS, (row) => [
        { label: 'Edit', icon: 'edit', permission: MANAGE, onSelect: () => setEditing(row) },
        {
          label: 'Delete',
          icon: 'delete',
          tone: 'danger',
          permission: MANAGE,
          disabled: row.usedBy > 0,
          onSelect: () => setRemoving(row),
        },
      ]),
    [],
  )

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={2} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  return (
    <>
    <PageBody>
      <PageHeader
        title="Attributes & options"
        description="The option sets a Variable product builds its variants from."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
            <Button size="control" icon="add" onClick={() => setEditing('new')}>
              New attribute
            </Button>
          </PermissionGate>
        }
      />

      <InlineAlert tone="warning" title="Removing a value affects live variants">
        A value in use cannot be deleted while variants reference it. Retire it instead — existing
        variants keep working and it stops appearing on new products.
      </InlineAlert>

      <SectionCard title={`${data.items.length} attributes`}>
        <Table
          className="rounded-none border-0 border-t"
          columns={columns}
          data={data.items}
          getRowKey={(attribute) => attribute.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>

      {editing && (
        <AttributeFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          isOpen
          onClose={() => setEditing(null)}
          attribute={editing === 'new' ? null : editing}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        description="An attribute still referenced by live variants cannot be removed."
        confirmLabel="Delete attribute"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removing.id })
          setRemoving(null)
        }}
      />
    </>
  )
}
