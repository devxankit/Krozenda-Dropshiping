import { Link } from 'react-router-dom'
import { INTEGRATION_HEALTH, INTEGRATION_HEALTH_LABELS } from '../../constants'

const HEALTH_DOT = Object.freeze({
  [INTEGRATION_HEALTH.OPERATIONAL]: 'bg-success-500',
  [INTEGRATION_HEALTH.DEGRADED]: 'bg-warning-500',
  [INTEGRATION_HEALTH.DOWN]: 'bg-danger-500',
  [INTEGRATION_HEALTH.NOT_CONFIGURED]: 'bg-border-strong',
})

// A slim strip rather than five cards: integration status is something you
// scan for the one amber dot, not something you read.
export function IntegrationHealthStrip({ integrations = [], to }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
        Integrations
      </span>
      {integrations.map((integration) => (
        <span key={integration.id} className="flex items-center gap-2 text-xs">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_DOT[integration.status]}`} />
          <span className="font-medium text-slate-900">{integration.name}</span>
          <span
            className={
              integration.status === INTEGRATION_HEALTH.OPERATIONAL
                ? 'text-ink-faint'
                : 'font-semibold text-warning-700'
            }
          >
            {integration.note || INTEGRATION_HEALTH_LABELS[integration.status]}
          </span>
        </span>
      ))}
      <Link to={to} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
        View all
      </Link>
    </div>
  )
}

// The lifecycle as a funnel. Single series, single hue — magnitude, not
// identity, so no legend and no categorical palette.
