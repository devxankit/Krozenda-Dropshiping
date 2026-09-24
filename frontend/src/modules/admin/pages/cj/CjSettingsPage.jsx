import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Badge,
  Button,
  Input,
  PasswordInput,
  Select,
  Modal,
  Icon,
  Switch,
} from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { useCjSettingsController } from '../../controllers/useCjController'

const STATUS_TONE = {
  CONNECTED: 'success',
  DISCONNECTED: 'neutral',
  FAILED: 'danger',
}

const CJ_NAV_ITEMS = [
  { label: 'Dashboard', to: ADMIN_ROUTES.CJ_DASHBOARD, icon: 'dashboard' },
  { label: 'Category', to: ADMIN_ROUTES.CJ_CATEGORY, icon: 'catalog' },
  { label: 'Products', to: ADMIN_ROUTES.CJ_PRODUCTS, icon: 'products' },
  { label: 'Orders', to: ADMIN_ROUTES.CJ_ORDERS, icon: 'orders' },
  { label: 'Onboard Products', to: ADMIN_ROUTES.CJ_CATALOGUE, icon: 'add' },
  { label: 'Settings', to: ADMIN_ROUTES.CJ_SETTINGS, icon: 'settings' },
]

export function CjSettingsPage() {
  const controller = useCjSettingsController()
  const location = useLocation()

  const [form, setForm] = useState({
    email: '',
    apiKey: '',
    environment: 'LIVE',
  })
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const [markupType, setMarkupType] = useState(() => controller.data?.defaultMarkupType || 'PERCENT')
  const [markupValue, setMarkupValue] = useState(() => controller.data?.defaultMarkupValue ?? controller.data?.defaultMarkupPercent ?? 30)
  const [priceRounding, setPriceRounding] = useState(() => controller.data?.priceRounding || 'ROUND')
  const [markupNotice, setMarkupNotice] = useState('')

  const [visibilityNotice, setVisibilityNotice] = useState('')

  const handleToggleVisibility = async (e) => {
    const next = e.target.checked
    try {
      await controller.updateVisibility({ dropshippingEnabled: next })
      setVisibilityNotice(next ? 'Products are now visible to customers.' : 'Products are now hidden from customers.')
      setTimeout(() => setVisibilityNotice(''), 3500)
    } catch {
      // Handled by controller.updateVisibilityError
    }
  }

  useEffect(() => {
    if (controller.data) {
      if (controller.data.defaultMarkupType) {
        setMarkupType(controller.data.defaultMarkupType)
      }
      if (controller.data.defaultMarkupValue != null) {
        setMarkupValue(controller.data.defaultMarkupValue)
      } else if (controller.data.defaultMarkupPercent != null) {
        setMarkupValue(controller.data.defaultMarkupPercent)
      }
      if (controller.data.priceRounding) {
        setPriceRounding(controller.data.priceRounding)
      }
    }
  }, [controller.data])

  const handleSaveMarkup = async (e) => {
    if (e) e.preventDefault()
    try {
      await controller.updateMarkupSettings({
        defaultMarkupType: markupType,
        defaultMarkupValue: Number(markupValue) || 30,
        defaultMarkupPercent: Number(markupValue) || 30,
        priceRounding,
      })
      setMarkupNotice('Markup rules updated.')
      setTimeout(() => setMarkupNotice(''), 3500)
    } catch {
      // Handled by controller error
    }
  }

  if (controller.isLoading) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping — Settings" description="Connect and configure the CJ Dropshipping account." />
        <PageSkeleton rows={5} />
      </PageBody>
    )
  }

  if (controller.error) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping — Settings" description="Connect and configure the CJ Dropshipping account." />
        <ErrorState error={controller.error} title="Unable to load CJ Settings" onRetry={controller.refetch} />
      </PageBody>
    )
  }

  const settings = controller.data
  const isConnected = settings?.status === 'CONNECTED'
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/cj`
    : '/api/webhooks/cj'

  const handleCopyWebhook = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(webhookUrl)
      setCopiedWebhook(true)
      setTimeout(() => setCopiedWebhook(false), 2500)
    }
  }

  const handleDisconnectConfirm = async () => {
    try {
      await controller.disconnect()
      setShowDisconnectModal(false)
    } catch {
      // Error handled by controller state
    }
  }

  return (
    <PageBody>
      {/* ── CJ MODULE NAVIGATION BAR ── */}
      <nav aria-label="CJ Navigation" className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
        {CJ_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-ink-subtle hover:text-slate-900 hover:bg-surface-muted'
              }`}
            >
              <Icon name={item.icon} className={`h-3.5 w-3.5 ${isActive ? 'text-brand-600' : 'text-ink-faint'}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── PAGE HEADER ── */}
      <PageHeader
        title="CJ Dropshipping — Settings"
        description="Connect and configure the CJ Dropshipping account."
        actions={
          <Badge tone={STATUS_TONE[settings?.status] || 'neutral'} dot size="md">
            {settings?.status || 'DISCONNECTED'}
          </Badge>
        }
      />

      {/* ── NOTIFICATIONS & FEEDBACK ── */}
      {controller.connectError && (
        <InlineAlert tone="danger" title="Connection Failed">
          {controller.connectError?.response?.data?.message || controller.connectError.message}
        </InlineAlert>
      )}

      {controller.testResult && (
        <InlineAlert
          tone={controller.testResult.success ? 'success' : 'danger'}
          title={controller.testResult.success ? 'Health Check Passed' : 'Health Check Failed'}
        >
          {controller.testResult.message}
        </InlineAlert>
      )}

      {settings?.failureReason && (
        <InlineAlert tone="warning" title="Last Recorded Failure">
          {settings.failureReason}
        </InlineAlert>
      )}

      {/* CJ meters API calls in daily points. Running out is a quota, not a
          broken connection — say so, so nobody reconnects for nothing. */}
      {settings?.apiPoints?.remaining != null &&
        (settings.apiPoints.paused || settings.apiPoints.remaining < 5000) && (
          <InlineAlert
            tone={settings.apiPoints.paused ? 'danger' : 'warning'}
            title={settings.apiPoints.paused ? 'CJ API points used up' : 'CJ API points running low'}
          >
            {settings.apiPoints.remaining.toLocaleString('en-IN')} of{' '}
            {(settings.apiPoints.total || 50000).toLocaleString('en-IN')} daily points left. Points refill every
            minute and reset fully at 5:30 AM IST. Catalogue and sync resume on their own — no need to reconnect.
          </InlineAlert>
        )}

      {/* ── STOREFRONT VISIBILITY ── */}
      <SectionCard
        title="Storefront Visibility"
        description="Show or hide dropshipping products on the customer-facing site."
        actions={visibilityNotice ? <Badge tone="success" dot size="sm">{visibilityNotice}</Badge> : null}
      >
        <div className="p-4 sm:p-5">
          {controller.updateVisibilityError && (
            <InlineAlert tone="danger" title="Could not update visibility">
              {controller.updateVisibilityError?.response?.data?.message || controller.updateVisibilityError.message}
            </InlineAlert>
          )}
          <Switch
            id="dropshipping-visibility"
            checked={settings?.dropshippingEnabled !== false}
            disabled={controller.isUpdatingVisibility}
            onChange={handleToggleVisibility}
            label="Show products to customers"
          />
        </div>
      </SectionCard>

      {/* ── MARKUP ── */}
      <SectionCard
        title="Markup & Pricing"
        description="Selling price is calculated automatically from CJ cost using this rule."
        actions={markupNotice ? <Badge tone="success" dot size="sm">{markupNotice}</Badge> : null}
      >
        <form onSubmit={handleSaveMarkup} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="defaultMarkupValue" className="text-xs font-semibold text-slate-700">
                  {markupType === 'PERCENT' ? 'Markup (%)' : 'Markup Amount (₹)'}
                </label>
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-muted">
                  <button
                    type="button"
                    onClick={() => {
                      if (markupType !== 'PERCENT') {
                        setMarkupType('PERCENT')
                        setMarkupValue('30')
                      }
                    }}
                    className={`px-2.5 py-0.5 text-2xs font-semibold rounded-md transition ${
                      markupType === 'PERCENT'
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'text-ink-subtle hover:text-slate-900'
                    }`}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (markupType !== 'FLAT') {
                        setMarkupType('FLAT')
                        setMarkupValue('150')
                      }
                    }}
                    className={`px-2.5 py-0.5 text-2xs font-semibold rounded-md transition ${
                      markupType === 'FLAT'
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'text-ink-subtle hover:text-slate-900'
                    }`}
                  >
                    ₹ Flat
                  </button>
                </div>
              </div>

              <Input
                id="defaultMarkupValue"
                type="number"
                min="0"
                max="50000"
                step="1"
                size="control"
                value={markupValue}
                onChange={(e) => setMarkupValue(e.target.value)}
              />
            </div>

            <div>
              <Select
                id="priceRoundingRule"
                label="Price Rounding"
                size="control"
                value={priceRounding}
                onChange={(e) => setPriceRounding(e.target.value)}
                options={[
                  { value: 'ROUND', label: 'Round to nearest ₹' },
                  { value: '9_ENDING', label: '9-Ending (e.g. ₹649)' },
                  { value: 'NONE', label: 'Exact price' },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="control" icon="save" isLoading={controller.isUpdatingMarkup}>
              Save
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* ── MAIN ACTIONS / CONNECT FORM BASED ON AUTH STATE ── */}
      <PermissionGate permission={ADMIN_PERMISSIONS.CJ_SETTINGS}>
        {isConnected ? (
          /* ── CONNECTED STATE: ACTIONS ── */
          <SectionCard title="Account" description="Verify connectivity, renew auth tokens, or disconnect.">
            <div className="p-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="control"
                  icon="refresh"
                  isLoading={controller.isTesting}
                  onClick={() => controller.testConnection()}
                >
                  Test Connection
                </Button>
                <Button
                  variant="secondary"
                  size="control"
                  icon="refresh"
                  isLoading={controller.isRefreshing}
                  onClick={() => controller.refreshToken()}
                >
                  Refresh Token
                </Button>
                <Button
                  variant="dangerOutline"
                  size="control"
                  icon="logout"
                  onClick={() => setShowDisconnectModal(true)}
                >
                  Disconnect
                </Button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Webhook URL</label>
                <p className="mt-1 text-2xs text-ink-subtle">Add this in the CJ developer portal for tracking updates.</p>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 max-w-md">
                  <code className="text-2xs font-mono text-slate-900 truncate flex-1">{webhookUrl}</code>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="shrink-0 p-1 text-ink-subtle hover:text-brand-600 transition-colors"
                    title="Copy Webhook URL"
                  >
                    <Icon name={copiedWebhook ? 'check' : 'copy'} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        ) : (
          /* ── DISCONNECTED STATE: CONNECT FORM ── */
          <SectionCard title="Connect CJ Dropshipping Account" description="Enter your account email and API Key from the CJ Dropshipping Open Platform.">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (form.email && form.apiKey) {
                  controller.connect(form)
                }
              }}
              className="p-5 space-y-4 max-w-lg"
            >
              <Input
                id="cjEmail"
                label="CJ Account Email"
                size="control"
                type="email"
                required
                placeholder="partner@yourcompany.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />

              <PasswordInput
                id="cjApiKey"
                label="CJ API Key"
                size="control"
                required
                placeholder="Enter your CJ Open Platform API Key"
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

              <Button
                size="control"
                className="w-full sm:w-auto min-w-[160px]"
                icon="link"
                isLoading={controller.isConnecting}
                disabled={!form.email || !form.apiKey}
              >
                Connect
              </Button>
            </form>
          </SectionCard>
        )}
      </PermissionGate>

      {/* ── DISCONNECT CONFIRMATION MODAL ── */}
      <Modal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Disconnect CJ Dropshipping Account?"
        description="Stored API keys will be removed from the server."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="control"
              onClick={() => setShowDisconnectModal(false)}
              disabled={controller.isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="control"
              icon="logout"
              isLoading={controller.isDisconnecting}
              onClick={handleDisconnectConfirm}
            >
              Yes, Disconnect
            </Button>
          </div>
        }
      >
        <p className="text-xs text-ink-subtle leading-relaxed py-2">
          This stops order forwarding and tracking sync with CJ. You can reconnect anytime.
        </p>
      </Modal>
    </PageBody>
  )
}

export default CjSettingsPage
