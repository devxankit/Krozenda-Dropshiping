import { SectionCard } from '../display'

export function OrderPipeline({ pipeline = [], exceptions = [] }) {
  const top = pipeline[0]?.count || 1

  return (
    <SectionCard title="Order pipeline" description="Sub-orders by lifecycle stage">
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        {pipeline.map((stage) => (
          <div key={stage.status} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2.5">
            <span className="truncate text-xs text-ink-muted">{stage.label}</span>
            <span className="h-2 rounded-full bg-surface-sunken">
              <span
                className="block h-2 rounded-full bg-brand-600"
                style={{ width: `${Math.max(2, (stage.count / top) * 100)}%` }}
              />
            </span>
            <span className="tabular text-right text-xs text-slate-800">
              {stage.count.toLocaleString('en-IN')}
            </span>
          </div>
        ))}

        <div className="mt-1.5 border-t border-border-subtle pt-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Exception branches
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {exceptions.map((exception) => (
              <span key={exception.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    exception.tone === 'danger'
                      ? 'bg-danger-700'
                      : exception.tone === 'warning'
                        ? 'bg-warning-700'
                        : 'bg-ink-subtle'
                  }`}
                />
                {exception.label}
                <span className="tabular font-semibold text-slate-900">{exception.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
