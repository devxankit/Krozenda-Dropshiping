import { SERIES } from './chartTheme'

// Title, legend and the plot area, as one object. Every chart card in the
// panel is this — so the legend sits in the same place, at the same size, on
// all of them.
//
// A legend is present whenever there are two or more series (identity is
// never carried by colour alone); a single-series chart is named by its title
// and gets no legend box.
export function ChartFrame({ title, description, series = [], actions, height = 260, children }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      {(title || series.length > 1 || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{description}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {series.length > 1 && <ChartLegend series={series} />}
            {actions}
          </div>
        </div>
      )}
      <div className="px-4 pb-3 pt-4" style={{ height }}>
        {children}
      </div>
    </section>
  )
}

export function ChartLegend({ series = [] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((item, index) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color || SERIES[index] }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// One tooltip for every chart type. Values are formatted by the caller, so the
// tooltip never has to know whether it is showing rupees, counts or percent.
export function ChartTooltip({ active, payload, label, formatValue = (value) => value, total }) {
  if (!active || !payload?.length) return null

  const sum = payload.reduce((accumulator, entry) => accumulator + (entry.value || 0), 0)

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-overlay">
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-3 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-muted">{entry.name}</span>
            <span className="tabular ml-auto font-semibold text-slate-900">
              {formatValue(entry.value)}
            </span>
          </li>
        ))}
      </ul>
      {total && payload.length > 1 && (
        <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-border-subtle pt-1.5 text-xs">
          <span className="text-ink-muted">Total</span>
          <span className="tabular font-semibold text-slate-900">{formatValue(sum)}</span>
        </p>
      )}
    </div>
  )
}
