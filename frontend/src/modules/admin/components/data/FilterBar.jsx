import { Button, Icon } from '../../../../components/ui'

// filters: [{ key, label, type: 'select', options: [{ value, label }] }]
// value:   { search: '', <key>: value }
//
// Driven entirely by a schema so a new list screen adds a filter by adding a
// row to its FILTER_SCHEMA — never by hand-wiring another select.
export function FilterBar({ filters = [], value = {}, onChange, searchPlaceholder = 'Search…', actions }) {
  function set(key, next) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex w-full items-center sm:w-72">
        <Icon name="search" className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint" />
        <input
          value={value.search || ''}
          onChange={(event) => set('search', event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          type="search"
          className="h-control w-full rounded-md border border-border bg-surface pl-9 pr-8 text-sm text-slate-900 shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-faint hover:border-border-strong focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {value.search && (
          <button
            type="button"
            onClick={() => set('search', '')}
            aria-label="Clear search"
            className="touch-auto-target absolute right-2 flex h-5 w-5 items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-sunken hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters.map((filter) => (
        <div key={filter.key} className="relative flex min-w-0 flex-1 items-center sm:flex-none">
          <select
            value={value[filter.key] || ''}
            onChange={(event) => set(filter.key, event.target.value)}
            aria-label={filter.label}
            className={`h-control w-full min-w-[8.5rem] cursor-pointer appearance-none rounded-md border pl-3 pr-8 text-sm shadow-xs transition-[border-color,box-shadow,background-color] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 ${
              value[filter.key]
                ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700'
                : 'border-border bg-surface text-ink-muted hover:border-border-strong'
            }`}
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-faint"
          />
        </div>
      ))}

      {actions && (
        <>
          <div className="hidden flex-1 sm:block" />
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </>
      )}
    </div>
  )
}

// The applied filters, as removable chips. Separated from the controls above
// because "what is currently filtering this list" is a different question
// from "what can I filter it by" — and the answer must survive scrolling.
export function FilterChips({ filters = [], value = {}, onChange, onClear }) {
  const applied = filters
    .filter((filter) => value[filter.key])
    .map((filter) => ({
      key: filter.key,
      label: filter.label,
      display:
        filter.options.find((option) => option.value === value[filter.key])?.label || value[filter.key],
    }))

  if (applied.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-subtle">Filtered by</span>
      {applied.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 animate-fade-in items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 pl-3 pr-1.5 text-xs font-medium text-brand-700"
        >
          {chip.label}: {chip.display}
          <button
            type="button"
            onClick={() => onChange({ ...value, [chip.key]: '' })}
            aria-label={`Remove ${chip.label} filter`}
            className="touch-auto-target flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Icon name="close" className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="xs" onClick={onClear}>
        Clear all
      </Button>
    </div>
  )
}
