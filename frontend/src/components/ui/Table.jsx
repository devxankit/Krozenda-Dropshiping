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
  default: 'h-row px-4',
  compact: 'h-9 px-3',
})

function SortIndicator({ state }) {
  if (!state) return <Icon name="chevronsRight" className="h-3 w-3 rotate-90 text-border-strong" />
  return (
    <Icon name={state === 'asc' ? 'chevronUp' : 'chevronDown'} className="h-3 w-3 text-brand-600" />
  )
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
  const cellClass = DENSITY[density]

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
    <div className={`admin-scroll overflow-x-auto rounded-lg border border-border ${className}`}>
      <table className="min-w-full border-collapse text-sm">
        <thead className={stickyHeader ? 'sticky top-0 z-sticky' : undefined}>
          <tr>
            {selectable && (
              <th className={`w-10 bg-surface-muted ${cellClass} border-b border-border`}>
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
                className={`whitespace-nowrap border-b border-border bg-surface-muted text-2xs font-semibold uppercase tracking-wider text-ink-faint ${cellClass} ${ALIGN[column.align] || ALIGN.left} ${column.headerClassName || ''}`}
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
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass}>
                      <Skeleton className="h-3 w-full max-w-[10rem]" />
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
                    className={`border-b border-border-subtle transition-colors last:border-b-0 ${isSelected ? 'bg-brand-50/40' : 'hover:bg-surface-muted'} ${onRowClick ? 'cursor-pointer' : ''}`}
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
                        className={`text-slate-800 ${cellClass} ${ALIGN[column.align] || ALIGN.left} ${column.cellClassName || ''}`}
                      >
                        {column.render ? column.render(row) : row[column.key]}
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
