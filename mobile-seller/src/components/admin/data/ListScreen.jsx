import { useState } from 'react'
import { Tabs } from '../../ui'
import { PageBody, PageHeader } from '../shell'
import { DataTable } from './DataTable'
import { FilterBar, FilterChips } from './FilterBar'

// Rule 05, as one component. A list screen supplies its columns, its filter schema, its tabs and
// its controller - everything else is decided here.
//
// Anything a particular screen needs that this does not cover goes in `banner` (above the tabs).
// `renderRowActions` exists on the web call sites but is never read by ListScreen; same here.
export function ListScreen({
  title,
  description,
  actions,
  banner,
  controller,
  columns,
  filters = [],
  tabs = [],
  searchPlaceholder = 'Search…',
  getRowKey = (row) => row.id,
  onRowClick,
  bulkActions,
  bulkLabel,
  selectable = false,
  itemLabel = 'results',
  emptyIcon = 'list',
  emptyTitle = 'Nothing matches these filters',
  emptyDescription = 'Try a different tab, or clear the filters to see everything.',
}) {
  // Pull-to-refresh (native addition): re-reads the current page.
  const [refreshing, setRefreshing] = useState(false)
  async function onRefresh() {
    setRefreshing(true)
    try {
      await controller.refetch?.()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <PageBody refreshing={refreshing} onRefresh={onRefresh}>
      <PageHeader title={title} description={description} actions={actions} />

      {banner}

      {tabs.length > 0 ? (
        <Tabs
          items={tabs.map((tab) => ({ ...tab, count: controller.tabCounts[tab.id] }))}
          activeId={controller.tab}
          onChange={controller.changeTab}
        />
      ) : null}

      <FilterBar
        filters={filters}
        value={controller.filters}
        onChange={controller.changeFilters}
        searchPlaceholder={searchPlaceholder}
      />

      <FilterChips
        filters={filters}
        value={controller.filters}
        onChange={controller.changeFilters}
        onClear={controller.clearFilters}
      />

      <DataTable
        columns={columns}
        data={controller.items}
        getRowKey={getRowKey}
        isLoading={controller.isLoading}
        error={controller.error}
        onRetry={controller.refetch}
        sort={controller.sort}
        onSortChange={controller.changeSort}
        selectable={selectable}
        selectedKeys={controller.selectedKeys}
        onSelectionChange={controller.setSelectedKeys}
        bulkActions={bulkActions}
        bulkLabel={bulkLabel}
        onRowClick={onRowClick}
        page={controller.page}
        totalPages={controller.totalPages}
        totalItems={controller.totalItems}
        rowsPerPage={controller.rowsPerPage}
        onPageChange={controller.setPage}
        onRowsPerPageChange={controller.changeRowsPerPage}
        itemLabel={itemLabel}
        emptyIcon={emptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={{ label: 'Clear filters', icon: 'close', onClick: controller.clearFilters }}
      />
    </PageBody>
  )
}
