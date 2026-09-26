import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

// columns: [{ key, header, render?(row), align?, width?, sortable?, headerClassName?, cellClassName? }]
//
// Sorting and selection are controlled — this component renders state and
// reports intent, it never owns either. That keeps the URL (or a controller)
// as the source of truth for what a list screen is showing.

const ALIGN = Object.freeze({
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
})

const DENSITY = Object.freeze({
  relaxed: 'h-12 sm:h-16 px-3 sm:px-5 py-2 sm:py-4 text-xs sm:text-sm',
  comfortable: 'h-11 sm:h-14 px-3 sm:px-3.5 py-2 sm:py-3 text-xs sm:text-sm',
  default: 'h-10 sm:h-row px-2.5 sm:px-4 text-xs sm:text-sm',
  compact: 'h-8 sm:h-9 px-2 sm:px-3 text-2xs sm:text-xs',
})

const HEADER_DENSITY = Object.freeze({
  relaxed: 'h-10 sm:h-12 px-3 sm:px-5 text-2xs sm:text-xs',
  comfortable: 'h-9 sm:h-11 px-3 sm:px-3.5 text-2xs sm:text-xs font-semibold',
  default: 'h-8.5 sm:h-10 px-2.5 sm:px-4 text-[10px] sm:text-xs font-semibold',
  compact: 'h-7 sm:h-9 px-2 sm:px-3 text-[9px] sm:text-2xs',
})

// Staggered skeleton widths, so a loading table reads as rows of data rather
// than a stack of identical bars.
const SKELETON_WIDTHS = Object.freeze(['max-w-[9rem]', 'max-w-[6rem]', 'max-w-[11rem]', 'max-w-[7rem]'])

function SortIndicator({ state }) {
  if (!state) return <Icon name="chevronsRight" className="h-3 w-3 rotate-90 text-border-strong" />
  return <Icon name={state === 'asc' ? 'chevronUp' : 'chevronDown'} className="h-3 w-3 text-brand-600" />
}

export function Table({
  columns = [],
  data = [],
  getRowKey = (row, index) => index,
  sort = null,
  onSortChange,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  onRowClick,
  density = 'default',
  stickyHeader = false,
  isLoading = false,
  skeletonRows = 6,
  emptyState = null,
  className = '',
}) {
  const selected = new Set(selectedKeys)
  const allKeys = data.map(getRowKey)
  const allSelected = data.length > 0 && allKeys.every((key) => selected.has(key))
  const someSelected = !allSelected && allKeys.some((key) => selected.has(key))
  const cellClass = DENSITY[density] || DENSITY.default
  const headerClass = HEADER_DENSITY[density] || HEADER_DENSITY.default

  function toggleAll() {
    onSelectionChange?.(allSelected ? [] : allKeys)
  }

  function toggleRow(key) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange?.([...next])
  }

  function requestSort(column) {
    if (!column.sortable || !onSortChange) return
    const isCurrent = sort?.key === column.key
    onSortChange({ key: column.key, direction: isCurrent && sort.direction === 'asc' ? 'desc' : 'asc' })
  }

  if (!isLoading && data.length === 0 && emptyState) {
    return (
      <div className={`overflow-hidden rounded-lg border border-border bg-surface ${className}`}>
        {emptyState}
      </div>
    )
  }

  return (
    <div
      className={`admin-scroll overflow-x-auto overflow-y-hidden rounded-lg border border-border ${className}`}
    >
      <table className="min-w-full border-collapse text-sm">
        <thead className={stickyHeader ? 'sticky top-0 z-sticky' : undefined}>
          <tr>
            {selectable && (
              <th className={`w-10 bg-surface-muted ${headerClass} border-b border-border`}>
                <Checkbox
                  id="table-select-all"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                aria-sort={
                  sort?.key === column.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                className={`whitespace-nowrap border-b border-border bg-surface-muted font-semibold uppercase tracking-wider text-ink-subtle ${headerClass} ${ALIGN[column.align] || ALIGN.left} ${column.headerClassName || ''}`}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => requestSort(column)}
                    className="inline-flex items-center gap-1.5 rounded-sm text-ink-muted transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {column.header}
                    <SortIndicator state={sort?.key === column.key ? sort.direction : null} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface">
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={`skeleton-${index}`} className="border-b border-border-subtle">
                  {selectable && (
                    <td className={cellClass}>
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className={cellClass}>
                      <Skeleton
                        className={`h-3 w-full ${SKELETON_WIDTHS[(index + columnIndex) % SKELETON_WIDTHS.length]} ${column.align === 'right' ? 'ml-auto' : ''}`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : data.map((row, index) => {
                const key = getRowKey(row, index)
                const isSelected = selected.has(key)
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-border-subtle transition-colors duration-100 last:border-b-0 ${isSelected ? 'bg-brand-50/70 hover:bg-brand-50' : 'hover:bg-slate-50/80'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className={cellClass} onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          id={`table-select-${key}`}
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap text-slate-800 ${cellClass} ${ALIGN[column.align] || ALIGN.left} ${column.cellClassName || ''}`}
                      >
                        {column.render ? column.render(row, index) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
