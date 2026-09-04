import { Button, Icon } from '../../../../components/ui'

// filters: [{ key, label, type: 'select', options: [{ value, label }] }]
// value:   { search: '', <key>: value }
//
// Driven entirely by a schema so a new list screen adds a filter by adding a
// row to its FILTER_SCHEMA — never by hand-wiring another select.
export function FilterBar({
  filters = [],
  value = {},
  onChange,
  searchPlaceholder = 'Search…',
  actions,
}) {
  function set(key, next) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex items-center">
        <Icon name="search" className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-faint" />
        <input
          value={value.search || ''}
          onChange={(event) => set('search', event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-control w-66 rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500"
          style={{ width: '16.5rem' }}
        />
      </div>

      {filters.map((filter) => (
        <div key={filter.key} className="relative flex items-center">
          <select
            value={value[filter.key] || ''}
            onChange={(event) => set(filter.key, event.target.value)}
            aria-label={filter.label}
            className={`h-control appearance-none rounded-md border bg-surface pl-3 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              value[filter.key]
                ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700'
                : 'border-border text-ink-muted'
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

      <div className="flex-1" />
      {actions}
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
        filter.options.find((option) => option.value === value[filter.key])?.label ||
        value[filter.key],
    }))

  if (applied.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-2xs text-ink-faint">Filtered by</span>
      {applied.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-brand-100 bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand-700"
        >
          {chip.label}: {chip.display}
          <button
            type="button"
            onClick={() => onChange({ ...value, [chip.key]: '' })}
            aria-label={`Remove ${chip.label} filter`}
            className="rounded transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
