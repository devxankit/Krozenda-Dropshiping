import { Link } from 'react-router-dom'
import { INTEGRATION_HEALTH, INTEGRATION_HEALTH_LABELS } from '../../constants'

const HEALTH_DOT = Object.freeze({
  [INTEGRATION_HEALTH.OPERATIONAL]: 'bg-success-500',
  [INTEGRATION_HEALTH.DEGRADED]: 'bg-warning-500',
  [INTEGRATION_HEALTH.DOWN]: 'bg-danger-500',
  [INTEGRATION_HEALTH.NOT_CONFIGURED]: 'bg-border-strong',
})

// A slim strip rather than five cards: integration status is something you
// scan for the one dot that is not green, not something you read. Status is
// reported by the server from its own connection and credentials, so
// "not configured" here means a key really is missing.
export function IntegrationHealthStrip({ integrations = [], to }) {
  const attention = integrations.filter(
    (integration) => integration.status !== INTEGRATION_HEALTH.OPERATIONAL,
  )

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-card">
      <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
        Integrations
        <span
          className={`rounded-full px-1.5 py-0.5 text-2xs font-semibold normal-case tracking-normal ${
            attention.length === 0 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
          }`}
        >
          {attention.length === 0 ? 'All operational' : `${attention.length} need setup`}
        </span>
      </span>

      {integrations.map((integration) => {
        const isOperational = integration.status === INTEGRATION_HEALTH.OPERATIONAL

        return (
          <span
            key={integration.id}
            className="flex items-center gap-2 text-xs"
            title={integration.note || INTEGRATION_HEALTH_LABELS[integration.status]}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_DOT[integration.status]}`} />
            <span className={isOperational ? 'text-ink-muted' : 'font-medium text-slate-900'}>
              {integration.name}
            </span>
            {!isOperational && (
              <span className="font-medium text-warning-700">
                {integration.note || INTEGRATION_HEALTH_LABELS[integration.status]}
              </span>
            )}
          </span>
        )
      })}

      <Link to={to} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
        View all
      </Link>
    </div>
  )
}
