import { Button, EmptyState, Pagination, Table } from '../../../../components/ui'
import { ErrorState } from '../feedback'
import { BulkActionBar } from './BulkActionBar'

// The list-screen body: bulk bar, table, pagination, and all four states,
// inside one bordered container. A list page supplies a column definition, a
// controller and an empty state — nothing else.
//
// Rule 05: PageHeader → FilterBar → BulkActionBar → DataTable → Pagination.
// This component owns the last three so a page cannot get the order wrong.
export function DataTable({
  columns,
  data = [],
  getRowKey,
  isLoading = false,
  error = null,
  onRetry,

  sort,
  onSortChange,

  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  bulkActions = [],
  bulkLabel = 'selected',

  onRowClick,
  density = 'default',

  page = 1,
  totalPages = 1,
  totalItems,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  itemLabel = 'results',

  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon = 'list',
}) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  const showEmpty = !isLoading && data.length === 0

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {selectable && selectedKeys.length > 0 && (
        <BulkActionBar
          count={selectedKeys.length}
          label={bulkLabel}
          actions={bulkActions}
          onClear={() => onSelectionChange([])}
        />
      )}

      {showEmpty ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyAction && (
                <Button
                  variant="secondary"
                  size="control"
                  icon={emptyAction.icon}
                  onClick={emptyAction.onClick}
                >
                  {emptyAction.label}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <Table
          className="rounded-none border-0"
          columns={columns}
          data={data}
          getRowKey={getRowKey}
          sort={sort}
          onSortChange={onSortChange}
          selectable={selectable}
          selectedKeys={selectedKeys}
          onSelectionChange={onSelectionChange}
          onRowClick={onRowClick}
          density={density}
          stickyHeader
          isLoading={isLoading}
        />
      )}

      {!showEmpty && (
        <div className="border-t border-border bg-surface px-4 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
            itemLabel={itemLabel}
          />
        </div>
      )}
    </div>
  )
}
