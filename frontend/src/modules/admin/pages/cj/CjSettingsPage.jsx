import { useState } from 'react'
import { Badge, Button, Input, Select } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { FormSection } from '../../components/forms'
import { SectionCard, KeyValueList } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useCjSettingsController } from '../../controllers/useCjController'

const STATUS_TONE = {
  CONNECTED: 'success',
  DISCONNECTED: 'neutral',
  FAILED: 'danger',
}

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function CjSettingsPage() {
  const controller = useCjSettingsController()
  const [form, setForm] = useState({ email: '', apiKey: '', environment: 'LIVE' })

  if (controller.isLoading) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping — Settings" description="Connect the platform's CJ account." />
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (controller.error) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping — Settings" />
        <ErrorState error={controller.error} onRetry={controller.refetch} />
      </PageBody>
    )
  }

  const settings = controller.data
  const isConnected = settings?.status === 'CONNECTED'

  return (
    <PageBody>
      <PageHeader
        title="CJ Dropshipping — Settings"
        description="One platform account for admin-fulfilled CJ products. Sellers never see this module."
        actions={<Badge tone={STATUS_TONE[settings?.status] || 'neutral'}>{settings?.status || 'DISCONNECTED'}</Badge>}
      />

      {controller.connectError && (
        <InlineAlert tone="danger" title="Could not connect">
          {controller.connectError?.response?.data?.message || controller.connectError.message}
        </InlineAlert>
      )}

      {controller.testResult && (
        <InlineAlert tone={controller.testResult.success ? 'success' : 'danger'} title={controller.testResult.message} />
      )}

      <SectionCard title="Connection status">
        <KeyValueList
          items={[
            { label: 'Status', value: settings?.status || 'DISCONNECTED' },
            { label: 'Environment', value: settings?.environment || '—' },
            { label: 'Credentials saved', value: settings?.hasCredentials ? 'Yes' : 'No' },
            { label: 'Last connection check', value: formatDate(settings?.lastConnectionCheckAt) },
            { label: 'Last success', value: formatDate(settings?.lastSuccessAt) },
            { label: 'Last failure', value: formatDate(settings?.lastFailureAt) },
            { label: 'Webhook configured', value: settings?.webhookConfigured ? 'Yes' : 'No — set CJ_WEBHOOK_SECRET' },
          ]}
        />
        {settings?.failureReason && (
          <InlineAlert tone="warning" title="Last failure reason">
            {settings.failureReason}
          </InlineAlert>
        )}
      </SectionCard>

      <PermissionGate permission={ADMIN_PERMISSIONS.CJ_SETTINGS}>
        {isConnected ? (
          <SectionCard
            title="Account actions"
            description="Credentials stay encrypted on the server — reconnecting replaces them entirely."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="control"
                isLoading={controller.isTesting}
                onClick={() => controller.testConnection()}
              >
                Test connection
              </Button>
              <Button
                variant="secondary"
                size="control"
                isLoading={controller.isRefreshing}
                onClick={() => controller.refreshToken()}
              >
                Refresh token
              </Button>
              <Button
                variant="danger"
                size="control"
                isLoading={controller.isDisconnecting}
                onClick={() => controller.disconnect()}
              >
                Disconnect
              </Button>
            </div>
          </SectionCard>
        ) : (
          <FormSection
            title="Connect CJ account"
            description="The account email and API key from your CJ Dropshipping developer settings."
            columns={2}
          >
            <Input
              id="cjEmail"
              label="Account email"
              size="control"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              id="cjApiKey"
              label="API key"
              type="password"
              size="control"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            />
            <Select
              id="cjEnvironment"
              label="Environment"
              size="control"
              value={form.environment}
              onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
              options={[
                { value: 'LIVE', label: 'Live' },
                { value: 'SANDBOX', label: 'Sandbox' },
              ]}
            />
            <div className="flex items-end">
              <Button
                size="control"
                isLoading={controller.isConnecting}
                disabled={!form.email || !form.apiKey}
                onClick={() => controller.connect(form)}
              >
                Connect
              </Button>
            </div>
          </FormSection>
        )}
      </PermissionGate>
    </PageBody>
  )
}
