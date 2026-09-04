import { Badge, Button, Icon } from '../../../../components/ui'
import { INTEGRATION_HEALTH_LABELS, INTEGRATION_HEALTH_TONE } from '../../constants'
import { KeyValueList, SectionCard } from '../display'

// One integration, with the thing that most often goes wrong made explicit:
// several of these depend on setup the CLIENT owns — a Razorpay Route
// provisioning, a DLT registration, SPF and DKIM records. A panel that hides
// that turns a three-day external dependency into a mystery outage.
export function IntegrationCard({ integration }) {
  const healthy = integration.status === 'operational'

  return (
    <SectionCard
      title={integration.name}
      description={integration.purpose}
      actions={
        <>
          <Badge tone={INTEGRATION_HEALTH_TONE[integration.status]} dot>
            {INTEGRATION_HEALTH_LABELS[integration.status]}
          </Badge>
          <Button variant="secondary" size="sm" icon="settings">
            Configure
          </Button>
        </>
      }
    >
      <div className="px-4 py-2">
        <KeyValueList
          columns={2}
          items={[
            { label: 'Environment', value: integration.environment },
            {
              label: 'Last event',
              value: integration.lastEventAt || <span className="text-ink-faint">none yet</span>,
            },
            {
              label: 'Account owned by',
              value: integration.ownedBy === 'client' ? 'Client' : 'Platform',
            },
            {
              label: 'Health',
              value: healthy ? 'All checks passing' : 'Needs attention',
            },
          ]}
        />
      </div>

      {integration.note && (
        <div
          className={`flex items-start gap-2.5 border-t px-4 py-3 ${
            healthy
              ? 'border-border-subtle text-ink-subtle'
              : 'border-warning-200 bg-warning-50 text-warning-700'
          }`}
        >
          <Icon name={healthy ? 'info' : 'warning'} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-2xs leading-relaxed">{integration.note}</p>
        </div>
      )}
    </SectionCard>
  )
}
