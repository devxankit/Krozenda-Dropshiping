import { Badge, Button } from '../../../../components/ui'
import { SectionCard } from '../display'
import { formatMoney } from '../../lib/format'

const RETURN_TONE = Object.freeze({
  due: 'warning',
  draft: 'neutral',
  filed: 'success',
  overdue: 'danger',
})

const RETURN_LABEL = Object.freeze({
  due: 'Due',
  draft: 'Draft',
  filed: 'Filed',
  overdue: 'Overdue',
})

export function StatutoryPosition({ position }) {
  return (
    <SectionCard
      title="Statutory position"
      description="For the current period, before the return is filed"
    >
      <ul className="divide-y divide-border-subtle">
        {position.map((row) => (
          <li
            key={row.label}
            className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${row.emphasis ? 'bg-brand-50/40' : ''}`}
          >
            <span
              className={`text-xs ${row.emphasis ? 'font-bold text-slate-900' : 'text-ink-subtle'}`}
            >
              {row.label}
            </span>
            <span
              className={`tabular font-semibold ${row.emphasis ? 'text-base text-brand-700' : 'text-xs text-slate-900'}`}
            >
              {formatMoney(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function StatutoryReturns({ returns }) {
  return (
    <SectionCard
      title="Returns"
      description="Exports are generated from posted ledger entries, not from the order tables"
    >
      <ul className="divide-y divide-border-subtle">
        {returns.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">{row.form}</span>
                <span className="text-2xs text-ink-faint">{row.period}</span>
              </span>
              <span className="mt-0.5 block text-2xs text-ink-subtle">{row.description}</span>
            </span>

            <span className="text-2xs text-ink-faint">Due {row.dueOn}</span>

            <Badge tone={RETURN_TONE[row.status]} size="sm" dot>
              {RETURN_LABEL[row.status]}
            </Badge>

            <span className="flex shrink-0 gap-1.5">
              {row.formats.map((format) => (
                <Button key={format} variant="secondary" size="sm">
                  {format}
                </Button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
