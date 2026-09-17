import { Icon } from './Icon'

const ROWS_PER_PAGE_OPTIONS = Object.freeze([25, 50, 100])

// Builds the page list with ellipses: always first and last, plus a window
// around the current page. Returns numbers and the string '…'.
function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const items = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) items.push('…')
  for (let index = start; index <= end; index += 1) items.push(index)
  if (end < totalPages - 1) items.push('…')
  items.push(totalPages)

  return items
}

// `size` is additive so the admin panel keeps its 32px density while the
// buyer app — where every one of these is tapped with a thumb — gets 40px
// targets. Below ~40px these were genuinely hard to hit on a phone.
const SIZE_CLASSES = Object.freeze({
  compact: { button: 'h-8 w-8', page: 'h-8 min-w-8 px-2 text-xs' },
  touch: { button: 'h-10 w-10', page: 'h-10 min-w-10 px-3 text-sm' },
})

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  rowsPerPage,
  onRowsPerPageChange,
  itemLabel = 'results',
  size = 'compact',
  className = '',
}) {
  const sizing = SIZE_CLASSES[size] || SIZE_CLASSES.compact
  const canPrev = page > 1
  const canNext = page < totalPages
  const from = rowsPerPage ? (page - 1) * rowsPerPage + 1 : null
  const to = rowsPerPage && totalItems ? Math.min(page * rowsPerPage, totalItems) : null

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 text-sm ${className}`}>
      <p className="text-xs text-ink-subtle">
        {totalItems !== undefined && from !== null ? (
          <>
            Showing <span className="tabular font-semibold text-slate-900">{from}–{to}</span> of{' '}
            <span className="tabular font-semibold text-slate-900">
              {totalItems.toLocaleString('en-IN')}
            </span>{' '}
            {itemLabel}
          </>
        ) : (
          <>
            Page <span className="tabular font-semibold text-slate-900">{page}</span> of{' '}
            <span className="tabular font-semibold text-slate-900">{totalPages}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        {onRowsPerPageChange && (
          <label className="flex items-center gap-2 text-xs text-ink-subtle">
            Rows
            <select
              value={rowsPerPage}
              onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className={`flex ${sizing.button} items-center justify-center rounded-md border border-border text-ink-muted transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40`}
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>

          {pageItems(page, totalPages).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-border-strong">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`tabular flex ${sizing.page} items-center justify-center rounded-md transition-colors ${
                  item === page
                    ? 'bg-brand-600 font-semibold text-white'
                    : 'text-ink-muted hover:bg-surface-muted'
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className={`flex ${sizing.button} items-center justify-center rounded-md border border-border text-ink-muted transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40`}
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  )
}
