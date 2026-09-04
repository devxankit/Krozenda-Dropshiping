import { useMemo, useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { CategoryFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import {
  useBrandsController,
  useCategoryTreeController,
  useCategoryWriteController,
} from '../../controllers/useCatalogController'
import { BRAND_COLUMNS, CATEGORY_COLUMNS } from '../../tableColumns/catalogColumns'
import { withRowActions } from '../../tableColumns/rowActions'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE

export function CategoriesPage() {
  const categories = useCategoryTreeController()
  const brands = useBrandsController()
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const writer = useCategoryWriteController({ onSaved: () => setEditing(null) })

  const categoryColumns = useMemo(
    () =>
      withRowActions(CATEGORY_COLUMNS, (row) => [
        { label: 'Edit', icon: 'edit', permission: MANAGE, onSelect: () => setEditing(row) },
        {
          label: 'Delete',
          icon: 'delete',
          tone: 'danger',
          permission: MANAGE,
          disabled: row.productCount > 0,
          onSelect: () => setRemoving(row),
        },
      ]),
    [],
  )

  if (categories.isLoading || brands.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (categories.error) {
    return (
      <PageBody>
        <ErrorState error={categories.error} onRetry={categories.refetch} />
      </PageBody>
    )
  }

  return (
    <>
    <PageBody>
      <PageHeader
        title="Categories & brands"
        description="A commission rate set on a parent category is inherited by its children unless they override it."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
            <Button variant="secondary" size="control" icon="add">
              New brand
            </Button>
            <Button size="control" icon="add" onClick={() => setEditing('new')}>
              New category
            </Button>
          </PermissionGate>
        }
      />

      <SectionCard title="Category tree" description="Two levels; drag to reorder">
        <Table
          className="rounded-none border-0 border-t"
          columns={categoryColumns}
          data={categories.data.nodes}
          getRowKey={(node) => node.id}
          density="compact"
        />
      </SectionCard>

      <SectionCard title="Brands" description="A brand must be approved before its products can go live">
        <Table
          className="rounded-none border-0 border-t"
          columns={BRAND_COLUMNS}
          data={brands.data.items}
          getRowKey={(brand) => brand.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>

      {editing && (
        <CategoryFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          isOpen
          onClose={() => setEditing(null)}
          category={editing === 'new' ? null : editing}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        description="Only an empty category can be removed. Products would otherwise be orphaned."
        confirmLabel="Delete category"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removing.id })
          setRemoving(null)
        }}
      />
    </>
  )
}
