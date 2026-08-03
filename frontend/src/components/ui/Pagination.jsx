import { Icon } from './Icon'

export function Pagination({ page, totalPages, onPageChange }) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        Prev
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
      >
        Next
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>
    </div>
  )
}
