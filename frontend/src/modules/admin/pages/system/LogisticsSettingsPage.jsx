import { Badge, Button, Input, Select, Switch } from '../../../../components/ui'
import { FormSection } from '../../components/forms'
import { InlineAlert } from '../../components/feedback'
import { SettingsShell } from '../../components/system/SettingsShell'
import { useShippingSettingsController } from '../../controllers/useShippingController'
import { integrationStatusPresentation, formatDateTime } from '../../../../lib/shipping/presentation'

// Settings > Logistics. The platform's shipping policy, wired to
// /admin/shipping/settings.
//
// This replaces a fixture-backed placeholder that rendered a generic
// "integration card" for Shiprocket and could not change anything. Every
// control here writes a real setting that the backend enforces.
//
// The platform's carrier credentials are NOT editable from this screen, and
// deliberately so: they live in the server environment (task §5). An admin can
// verify them and see whether they are present, never read or type them.

const STRATEGY_HELP = {
  RECOMMENDED: "Shiprocket's own recommendation. Balances price, speed and courier rating.",
  CHEAPEST: 'Lowest quoted rate, whatever the delivery estimate.',
  FASTEST: 'Shortest delivery estimate, whatever the rate.',
  MANUAL: 'No automatic choice — a seller picks the courier on every parcel.',
}

export function LogisticsSettingsPage() {
  const controller = useShippingSettingsController()

  return (
    <SettingsShell
      title="Logistics"
      description="Which courier account ships each parcel, how couriers are chosen, and how tracking stays current."
      controller={controller}
      changed={controller.changed}
      saveNote="Applies to new shipments. Parcels already booked keep the account and rates they were created with."
      onSave={controller.save}
      onDiscard={controller.discard}
      isSaving={controller.isSaving}
    >
      {() => {
        const { settings, readiness, platformAccount, strategies } = controller
        if (!settings) return null

        return (
          <>
            <ReadinessNotices readiness={readiness} settings={settings} />

            {controller.saveError && (
              <InlineAlert tone="danger" title="Could not save">
                {controller.saveError?.message || 'Some settings were rejected.'}
              </InlineAlert>
            )}

            <FormSection
              title="Master switch"
              description="Off blocks every new shipment. Parcels already in transit stay trackable."
              columns={1}
            >
              <Switch
                id="shippingEnabled"
                checked={settings.shippingEnabled}
                onChange={(e) => controller.update('shippingEnabled', e.target.checked)}
                label="Shipping enabled"
                description="When off, sellers cannot book a courier at all."
              />
              <Switch
                id="codEnabled"
                checked={settings.codEnabled}
                onChange={(e) => controller.update('codEnabled', e.target.checked)}
                label="Cash on delivery"
                description="Allows COD parcels where the courier supports it on that lane."
              />
              <div className="pt-2 max-w-xs">
                <Input
                  id="freeShippingThreshold"
                  label="Free shipping threshold (₹)"
                  type="number"
                  min="0"
                  size="control"
                  value={settings.freeShippingThreshold ?? 0}
                  onChange={(e) => controller.update('freeShippingThreshold', Math.max(0, Number(e.target.value)))}
                  description="Orders at or above this subtotal ship free. Set to 0 to charge customers the real courier delivery fee."
                />
              </div>
            </FormSection>

            <FormSection
              title="Which account ships"
              description="Sellers may use their own Shiprocket account, the platform's, or neither."
              columns={1}
            >
              <Switch
                id="sellerOwnAccountEnabled"
                checked={settings.sellerOwnAccountEnabled}
                onChange={(e) => controller.update('sellerOwnAccountEnabled', e.target.checked)}
                label="Sellers may connect their own Shiprocket account"
                description="Their rates, their pickup addresses, their invoices."
              />
              <Switch
                id="platformFallbackEnabled"
                checked={settings.platformFallbackEnabled}
                onChange={(e) => controller.update('platformFallbackEnabled', e.target.checked)}
                label="Fall back to the platform account"
                description="Used for sellers with no working account of their own. Off means their shipments are refused instead of being billed to you."
              />

              {!settings.sellerOwnAccountEnabled && !settings.platformFallbackEnabled && (
                <InlineAlert tone="danger" title="No account can ship anything">
                  With both of these off, every shipment will be refused. Turn at least one on.
                </InlineAlert>
              )}
            </FormSection>

            <PlatformAccountSection controller={controller} account={platformAccount} readiness={readiness} />

            <FormSection
              title="Courier selection"
              description="How a courier is chosen when a seller does not pick one."
            >
              <Select
                id="courierSelectionStrategy"
                label="Strategy"
                size="control"
                value={settings.courierSelectionStrategy}
                onChange={(e) => controller.update('courierSelectionStrategy', e.target.value)}
                description={STRATEGY_HELP[settings.courierSelectionStrategy]}
                options={strategies.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))}
              />
              <Input
                id="blockedCourierIds"
                label="Blocked courier IDs"
                size="control"
                value={settings.blockedCourierIds.join(', ')}
                onChange={(e) =>
                  controller.update(
                    'blockedCourierIds',
                    e.target.value
                      .split(',')
                      .map((part) => Number(part.trim()))
                      .filter((n) => Number.isInteger(n) && n > 0)
                  )
                }
                description="Shiprocket courier_company_id values to never auto-select. A manual pick still wins."
              />
            </FormSection>

            <FormSection
              title="Default package"
              description="Used when a product has no saved dimensions and the seller has set no default of their own."
            >
              <Input
                id="volumetricDivisor"
                label="Volumetric divisor"
                type="number"
                size="control"
                value={settings.volumetricDivisor}
                onChange={(e) => controller.update('volumetricDivisor', Number(e.target.value))}
                description="(L × B × H) ÷ this. Usually 5000, but it varies by courier — which is why it is a setting."
              />
              <Input
                id="pkgLength"
                label="Length (cm)"
                type="number"
                size="control"
                value={settings.defaultPackage.lengthCm}
                onChange={(e) => controller.updatePackage('lengthCm', Number(e.target.value))}
              />
              <Input
                id="pkgBreadth"
                label="Breadth (cm)"
                type="number"
                size="control"
                value={settings.defaultPackage.breadthCm}
                onChange={(e) => controller.updatePackage('breadthCm', Number(e.target.value))}
              />
              <Input
                id="pkgHeight"
                label="Height (cm)"
                type="number"
                size="control"
                value={settings.defaultPackage.heightCm}
                onChange={(e) => controller.updatePackage('heightCm', Number(e.target.value))}
              />
              <Input
                id="pkgWeight"
                label="Weight (kg)"
                type="number"
                step="0.01"
                size="control"
                value={settings.defaultPackage.weightKg}
                onChange={(e) => controller.updatePackage('weightKg', Number(e.target.value))}
              />
            </FormSection>

            <FormSection
              title="Tracking"
              description="Carrier webhooks are primary. This poll is the fallback for the ones that get lost."
            >
              <Switch
                id="trackingPollEnabled"
                checked={settings.trackingPollEnabled}
                onChange={(e) => controller.update('trackingPollEnabled', e.target.checked)}
                label="Poll for lost updates"
                description="Off means a dropped webhook leaves a parcel stuck at its last known status."
                className="sm:col-span-2"
              />
              <Input
                id="trackingPollCron"
                label="Poll schedule (cron)"
                size="control"
                value={settings.trackingPollCron}
                onChange={(e) => controller.update('trackingPollCron', e.target.value)}
                description="Takes effect after the next server restart."
              />
              <Input
                id="trackingStaleAfterMinutes"
                label="Consider stale after (minutes)"
                type="number"
                size="control"
                value={settings.trackingStaleAfterMinutes}
                onChange={(e) => controller.update('trackingStaleAfterMinutes', Number(e.target.value))}
                description="Only parcels not updated within this window are fetched. Minimum 15."
              />
              <Input
                id="trackingPollBatchSize"
                label="Parcels per cycle"
                type="number"
                size="control"
                value={settings.trackingPollBatchSize}
                onChange={(e) => controller.update('trackingPollBatchSize', Number(e.target.value))}
                description="Checked one at a time, so a large batch takes proportionally longer."
              />
            </FormSection>
          </>
        )
      }}
    </SettingsShell>
  )
}

// A toggle that cannot work because an environment variable is missing should
// say so here, rather than failing at the first shipment.
function ReadinessNotices({ readiness, settings }) {
  if (!readiness) return null
  const notices = []

  if (settings.shippingEnabled && !readiness.platformCredentialsConfigured && settings.platformFallbackEnabled) {
    notices.push(
      <InlineAlert key="platform" tone="danger" title="Platform fallback is on, but there are no platform credentials">
        Set <code>SHIPROCKET_EMAIL</code> and <code>SHIPROCKET_PASSWORD</code> in the server environment. Until then,
        sellers without their own account cannot ship.
      </InlineAlert>
    )
  }

  if (settings.sellerOwnAccountEnabled && !readiness.credentialEncryptionConfigured) {
    notices.push(
      <InlineAlert key="encryption" tone="danger" title="Sellers cannot connect their own accounts">
        <code>SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY</code> is not set, so there is nowhere safe to store a seller&apos;s
        password. The connect form is hidden from sellers until it is.
      </InlineAlert>
    )
  }

  if (settings.shippingEnabled && !readiness.webhookConfigured) {
    notices.push(
      <InlineAlert key="webhook" tone="warning" title="Tracking webhooks are not configured">
        <code>SHIPROCKET_WEBHOOK_TOKEN</code> is not set, so the webhook endpoint refuses every delivery. Tracking will
        fall back to the poll below, which is slower.
      </InlineAlert>
    )
  }

  return notices.length > 0 ? <>{notices}</> : null
}

function PlatformAccountSection({ controller, account, readiness }) {
  const presentation = account ? integrationStatusPresentation(account.status) : null

  return (
    <FormSection
      title="Platform Shiprocket account"
      description="Credentials live in the server environment and cannot be viewed or changed from this screen."
      columns={1}
    >
      <div className="flex flex-wrap items-center gap-3">
        {!readiness?.platformCredentialsConfigured ? (
          <Badge tone="neutral" dot>
            Not configured
          </Badge>
        ) : (
          <>
            <Badge tone={presentation?.tone || 'neutral'} dot>
              {presentation?.label || 'Unknown'}
            </Badge>
            {account?.maskedEmail && <span className="font-mono text-xs text-ink-subtle">{account.maskedEmail}</span>}
            {account?.lastSuccessfulAt && (
              <span className="text-2xs text-ink-faint">last verified {formatDateTime(account.lastSuccessfulAt)}</span>
            )}
          </>
        )}

        <Button
          variant="secondary"
          size="control"
          icon="refresh"
          onClick={() => controller.testPlatformConnection().catch(() => {})}
          isLoading={controller.isTesting}
          disabled={!readiness?.platformCredentialsConfigured}
        >
          Test connection
        </Button>
      </div>

      {controller.testError && (
        <InlineAlert tone="danger" title="Connection failed">
          {controller.testError?.message || 'Shiprocket rejected the platform credentials.'}
        </InlineAlert>
      )}
      {controller.testResult?.connected && (
        <InlineAlert tone="success" title="Connected">
          The platform account authenticated with Shiprocket.
        </InlineAlert>
      )}
      {account?.failureReason && !controller.testResult?.connected && (
        <InlineAlert tone="warning" title="Last failure">
          {account.failureReason}
        </InlineAlert>
      )}
    </FormSection>
  )
}
