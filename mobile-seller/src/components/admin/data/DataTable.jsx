import { StyleSheet, View } from 'react-native'
import { Button, EmptyState, Pagination, Table } from '../../ui'
import { ErrorState } from '../feedback'
import { BulkActionBar } from './BulkActionBar'
import { colors, radius, shadows } from '../../../theme'

// The list-screen body: bulk bar, table, pagination, and all four states, inside one bordered
// container. The table scrolls horizontally exactly as the web does at phone width.
//
// Rule 05: PageHeader -> FilterBar -> BulkActionBar -> DataTable -> Pagination.
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
    <View style={styles.box}>
      {selectable && selectedKeys.length > 0 ? (
        <BulkActionBar
          count={selectedKeys.length}
          label={bulkLabel}
          actions={bulkActions}
          onClear={() => onSelectionChange([])}
        />
      ) : null}

      {showEmpty ? (
        <View style={{ padding: 8 }}>
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyAction ? (
                <Button variant="secondary" size="sm" icon={emptyAction.icon} onPress={emptyAction.onClick}>
                  {emptyAction.label}
                </Button>
              ) : undefined
            }
          />
        </View>
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

      {!showEmpty ? (
        <View style={styles.pager}>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
            itemLabel={itemLabel}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    minWidth: 0, overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.slate[200] + 'cc', backgroundColor: colors.surface.DEFAULT, ...shadows.xs,
  },
  pager: {
    borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 12, paddingVertical: 8,
  },
})
