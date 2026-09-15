import { SectionCard } from '../display'
import { NoData } from '../feedback'

const EXCEPTION_DOT = Object.freeze({
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  neutral: 'bg-ink-faint',
})

// The lifecycle as a funnel. Single series, single hue — magnitude, not
// identity, so no legend and no categorical palette. Bars are scaled against
// the busiest stage; the percentage beside each one is its share of every
// order in the window, which is the number a reader is actually after.
export function OrderPipeline({ pipeline = [], exceptions = [] }) {
  const peak = Math.max(1, ...pipeline.map((stage) => stage.count))
  const total = pipeline.reduce((sum, stage) => sum + stage.count, 0)
  const visibleExceptions = exceptions.filter((exception) => exception.count > 0)

  return (
    <SectionCard title="Order pipeline" description="Orders by lifecycle stage">
      <div className="flex flex-col gap-3 px-4 py-3.5">
        {total === 0 ? (
          <NoData message="No orders in this window" hint="Pick a longer range to see the funnel." />
        ) : (
          pipeline.map((stage) => (
            <div key={stage.status} className="grid grid-cols-[6rem_minmax(0,1fr)_4.5rem] items-center gap-3">
              <span className="truncate text-xs text-ink-muted">{stage.label}</span>
              <span className="h-2 rounded-full bg-surface-sunken">
                <span
                  className="block h-2 rounded-full bg-brand-600 transition-[width] duration-500"
                  style={{ width: `${Math.max(2, (stage.count / peak) * 100)}%` }}
                />
              </span>
              <span className="flex items-baseline justify-end gap-1.5">
                <span className="tabular text-xs font-semibold text-slate-800">
                  {stage.count.toLocaleString('en-IN')}
                </span>
                <span className="tabular text-2xs text-ink-faint">
                  {Math.round((stage.count / total) * 100)}%
                </span>
              </span>
            </div>
          ))
        )}

        <div className="mt-1 border-t border-border-subtle pt-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Exception branches
          </p>
          {visibleExceptions.length === 0 ? (
            <p className="mt-2 text-xs text-ink-subtle">
              Nothing cancelled, returned or refunded in this window.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {visibleExceptions.map((exception) => (
                <span
                  key={exception.label}
                  className="flex items-center gap-1.5 text-xs text-ink-muted"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${EXCEPTION_DOT[exception.tone] || EXCEPTION_DOT.neutral}`}
                  />
                  {exception.label}
                  <span className="tabular font-semibold text-slate-900">{exception.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
