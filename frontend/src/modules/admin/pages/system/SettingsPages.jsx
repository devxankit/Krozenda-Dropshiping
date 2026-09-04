import { Badge, Button, Input, Switch, Table } from '../../../../components/ui'
import { FormSection } from '../../components/forms'
import { InlineAlert } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { SettingsShell } from '../../components/system/SettingsShell'
import { IntegrationCard } from '../../components/system/IntegrationCard'
import { POLICY_COLUMNS, SLAB_COLUMNS } from '../../tableColumns/systemColumns'
import {
  useGeneralSettingsController,
  useIntegrationsController,
  usePolicySettingsController,
  useSecuritySettingsController,
  useTaxSettingsController,
  useWebhooksController,
} from '../../controllers/useSystemController'

export function GeneralSettingsPage() {
  const controller = useGeneralSettingsController()

  return (
    <SettingsShell
      title="General"
      description="Who the platform is, how buyers reach it, and which capabilities are switched on."
      controller={controller}
    >
      {(data) => (
        <>
          <FormSection title="Platform identity" description="Appears on invoices and in transactional messages">
            <Input id="name" label="Platform name" size="control" defaultValue={data.platform.name} />
            <Input id="entity" label="Legal entity" size="control" defaultValue={data.platform.legalEntity} />
            <Input id="gstin" label="GSTIN" size="control" defaultValue={data.platform.gstin} />
            <Input id="email" label="Support email" size="control" defaultValue={data.platform.supportEmail} />
            <Input id="phone" label="Support phone" size="control" defaultValue={data.platform.supportPhone} />
            <Input id="tz" label="Timezone" size="control" defaultValue={data.platform.timezone} disabled />
          </FormSection>

          <FormSection title="Capabilities" columns={1}>
            {data.toggles.map((toggle) => (
              <Switch
                key={toggle.key}
                id={toggle.key}
                checked={toggle.enabled}
                onChange={() => {}}
                label={toggle.label}
                description={toggle.description}
              />
            ))}
          </FormSection>
        </>
      )}
    </SettingsShell>
  )
}


export function TaxSettingsPage() {
  const controller = useTaxSettingsController()

  return (
    <SettingsShell
      title="Taxes & HSN"
      description="The GST slabs a product can be assigned, and the rules that decide how tax is applied."
      controller={controller}
    >
      {(data) => (
        <>
          <SectionCard title="GST slabs" description="A product must be on exactly one slab">
            <Table
              className="rounded-none border-0 border-t"
              columns={SLAB_COLUMNS}
              data={data.slabs}
              getRowKey={(row) => row.rate}
              density="compact"
            />
          </SectionCard>

          <FormSection title="Defaults">
            <Input id="pos" label="Place of supply" size="control" defaultValue={data.defaults.placeOfSupplyRule} disabled />
            <Input id="hsn" label="HSN required" size="control" defaultValue={data.defaults.hsnRequiredFrom} disabled />
            <Input id="rounding" label="Rounding" size="control" defaultValue={data.defaults.roundingRule} />
            <Input id="prefix" label="Invoice prefix" size="control" defaultValue={data.defaults.invoicePrefix} />
          </FormSection>

          <InlineAlert tone="info" title="Place of supply decides IGST against CGST plus SGST">
            When the buyer&rsquo;s state differs from the supplier&rsquo;s registered state the supply is
            inter-state and attracts IGST. Same state splits into CGST and SGST at half the rate
            each.
          </InlineAlert>
        </>
      )}
    </SettingsShell>
  )
}


export function PoliciesPage() {
  const controller = usePolicySettingsController()

  return (
    <SettingsShell
      title="Policies & legal"
      description="Policy versions and who has accepted which. The legal text itself is supplied by the client."
      controller={controller}
      actions={
        <Button variant="secondary" size="control" icon="externalLink">
          Edit content
        </Button>
      }
    >
      {(data) => (
        <>
          <InlineAlert tone="warning" title="Publishing a version invalidates the previous acceptance">
            Everyone who accepted the old version is prompted again on their next sign-in. Their
            earlier acceptance stays on record with its timestamp and IP — it is evidence, not a
            setting.
          </InlineAlert>

          <SectionCard title="Policy versions">
            <Table
              className="rounded-none border-0 border-t"
              columns={POLICY_COLUMNS}
              data={data.items}
              getRowKey={(row) => row.id}
              density="compact"
            />
          </SectionCard>
        </>
      )}
    </SettingsShell>
  )
}

// Payments, logistics and notifications all read the same integration list —
// each screen just filters it to the integrations it owns.
function IntegrationSettings({ title, description, ids, note }) {
  const controller = useIntegrationsController()

  return (
    <SettingsShell title={title} description={description} controller={controller}>
      {(data) => (
        <>
          {note}
          {data.items
            .filter((item) => ids.includes(item.id))
            .map((item) => (
              <IntegrationCard key={item.id} integration={item} />
            ))}
        </>
      )}
    </SettingsShell>
  )
}

export function PaymentSettingsPage() {
  return (
    <IntegrationSettings
      title="Payments"
      description="Razorpay keys, Route linked accounts and webhook signature verification."
      ids={['razorpay']}
      note={
        <InlineAlert tone="info" title="Route is the compliance path, not a preference">
          The platform may not collect vendor funds into its own account and disburse them without
          a payment aggregator licence. Every vendor is a Route linked account with its own KYC.
        </InlineAlert>
      }
    />
  )
}

export function LogisticsSettingsPage() {
  return (
    <IntegrationSettings
      title="Logistics"
      description="Shiprocket credentials, per-vendor pickup locations and courier allocation rules."
      ids={['shiprocket']}
      note={
        <InlineAlert tone="info" title="Pickup locations are client-owned setup">
          Each vendor needs a pickup location registered in the Shiprocket account before an AWB
          can be generated for them.
        </InlineAlert>
      }
    />
  )
}

export function NotificationSettingsPage() {
  return (
    <IntegrationSettings
      title="Notifications"
      description="SMS India Hub, SMTP and Firebase Cloud Messaging."
      ids={['sms', 'smtp', 'fcm']}
      note={
        <InlineAlert tone="warning" title="Every OTP goes through SMS India Hub">
          Firebase is push notifications only — no Phone Auth, no Firestore, no Storage. OTP
          generation, hashing, expiry and rate limiting are the platform&rsquo;s own.
        </InlineAlert>
      }
    />
  )
}

export function IntegrationHealthPage() {
  const controller = useIntegrationsController()

  return (
    <SettingsShell
      title="Integration health"
      description="Live status for the five integrations in scope. Nothing else is connected."
      controller={controller}
      actions={
        <Button variant="secondary" size="control" icon="refresh">
          Re-check now
        </Button>
      }
    >
      {(data) => data.items.map((item) => <IntegrationCard key={item.id} integration={item} />)}
    </SettingsShell>
  )
}

export function SecuritySettingsPage() {
  const controller = useSecuritySettingsController()

  return (
    <SettingsShell
      title="Security"
      description="What it takes to reach the panel, and who has tried recently."
      controller={controller}
    >
      {(data) => (
        <>
          <FormSection title="Policies" columns={1}>
            {data.policies.map((policy) => (
              <Switch
                key={policy.key}
                id={policy.key}
                checked={policy.enabled}
                onChange={() => {}}
                label={policy.label}
                description={policy.description}
              />
            ))}
          </FormSection>

          <FormSection title="Limits">
            <Input id="session" label="Session length" size="control" suffix="hours" defaultValue={data.sessionMaxHours} />
            <Input id="pwlen" label="Minimum password length" size="control" defaultValue={data.passwordMinLength} />
            <Input id="lockout" label="Lock after failed attempts" size="control" defaultValue={data.lockoutAttempts} />
          </FormSection>

          <SectionCard title="IP allowlist" description="Only enforced while the policy above is on">
            <div className="flex flex-wrap gap-2 px-4 py-3.5">
              {data.ipAllowlist.map((entry) => (
                <span key={entry} className="tabular rounded-md bg-surface-sunken px-2 py-1 text-2xs text-ink-muted">
                  {entry}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recent sign-ins" description="Every attempt, successful or not">
            <ul className="divide-y divide-border-subtle">
              {data.recentSignIns.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-900">
                      {entry.person}
                    </span>
                    <span className="tabular block text-2xs text-ink-faint">
                      {entry.ip} · {entry.location} · {entry.device}
                    </span>
                  </span>
                  <span className="text-2xs text-ink-muted">{entry.at}</span>
                  <Badge
                    tone={
                      entry.outcome === 'success'
                        ? 'success'
                        : entry.outcome === 'locked'
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    dot
                  >
                    {entry.outcome.charAt(0).toUpperCase() + entry.outcome.slice(1)}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </SettingsShell>
  )
}

const ENDPOINT_TONE = { healthy: 'success', failing: 'danger', disabled: 'neutral' }

export function ApiWebhooksPage() {
  const controller = useWebhooksController()

  return (
    <SettingsShell
      title="API keys & webhooks"
      description="Inbound keys the integrations authenticate with, and the endpoints the platform delivers to."
      controller={controller}
      actions={
        <Button size="control" icon="add">
          New key
        </Button>
      }
    >
      {(data) => (
        <>
          <SectionCard title="API keys" description="A key is shown in full once, at creation">
            <ul className="divide-y divide-border-subtle">
              {data.keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{key.label}</span>
                    <span className="tabular block text-2xs text-ink-faint">
                      {key.prefix}••••••••
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} tone="neutral" size="sm">
                        {scope}
                      </Badge>
                    ))}
                  </span>
                  <span className="text-2xs text-ink-faint">
                    {key.lastUsedAt ? `Used ${key.lastUsedAt}` : 'Never used'}
                  </span>
                  <Button variant="dangerOutline" size="sm">
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Outbound endpoints"
            description="Deliveries are signed and retried; every handler must be idempotent"
          >
            <ul className="divide-y divide-border-subtle">
              {data.endpoints.map((endpoint) => (
                <li key={endpoint.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="tabular block truncate text-xs font-semibold text-slate-900">
                      {endpoint.url}
                    </span>
                    <span className="block truncate text-2xs text-ink-faint">
                      {endpoint.events.join(' · ')}
                    </span>
                  </span>
                  {endpoint.failures24h > 0 && (
                    <span className="tabular text-2xs font-semibold text-danger-700">
                      {endpoint.failures24h} failures in 24h
                    </span>
                  )}
                  <Badge tone={ENDPOINT_TONE[endpoint.status]} size="sm" dot>
                    {endpoint.status.charAt(0).toUpperCase() + endpoint.status.slice(1)}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </SettingsShell>
  )
}
