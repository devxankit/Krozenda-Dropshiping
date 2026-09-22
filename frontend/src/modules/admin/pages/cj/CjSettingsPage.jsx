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
import { SectionCard, KeyValueList } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { ADMIN_ROUTES } from '../../../../config/routes'
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
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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
      setVisibilityNotice(next ? 'Dropshipping products are now visible to customers.' : 'Dropshipping products are now hidden from customers.')
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
      setMarkupNotice('Default markup & pricing rules updated successfully!')
      setTimeout(() => setMarkupNotice(''), 3500)
    } catch {
      // Handled by controller error
    }
  }

  if (controller.isLoading) {
    return (
      <PageBody>
        <PageHeader
          title="CJ Dropshipping — Settings"
          description="Connect and configure the platform's official CJ Dropshipping account."
        />
        <PageSkeleton rows={5} />
      </PageBody>
    )
  }

  if (controller.error) {
    return (
      <PageBody>
        <PageHeader
          title="CJ Dropshipping — Settings"
          description="Connect and configure the platform's official CJ Dropshipping account."
        />
        <ErrorState
          error={controller.error}
          title="Unable to load CJ Settings"
          onRetry={controller.refetch}
        />
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
        description="One platform-level account for admin-fulfilled CJ catalog products. Sellers never see or manage these credentials."
        actions={
          <div className="flex items-center gap-2">
            <Badge
              tone={STATUS_TONE[settings?.status] || 'neutral'}
              dot
              size="md"
            >
              {settings?.status || 'DISCONNECTED'}
            </Badge>
          </div>
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

      {/* ── METRIC TILES / HEALTH OVERVIEW ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status Card */}
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-subtle">Connection Status</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected
                  ? 'bg-success-500 ring-4 ring-success-100 animate-pulse'
                  : settings?.status === 'FAILED'
                    ? 'bg-danger-500 ring-4 ring-danger-100'
                    : 'bg-slate-300'
              }`}
            />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings?.status || 'DISCONNECTED'}
          </p>
          <p className="mt-0.5 text-2xs text-ink-muted truncate">
            {isConnected ? 'Live sync & fulfillment active' : 'API authorization required'}
          </p>
        </div>

        {/* Environment Card */}
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-subtle">Environment</span>
            <Icon name="server" className="h-4 w-4 text-ink-faint" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings?.environment || 'LIVE'}
          </p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {settings?.environment === 'SANDBOX'
              ? 'Test mode — simulated orders'
              : 'Production fulfillment mode'}
          </p>
        </div>

        {/* Credentials Card */}
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-subtle">Stored Credentials</span>
            <Icon name="lock" className="h-4 w-4 text-ink-faint" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings?.hasCredentials ? 'Encrypted' : 'Not Saved'}
          </p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {settings?.hasCredentials ? 'AES-256 secure at rest' : 'Provide API Key below'}
          </p>
        </div>

        {/* Webhook Card */}
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-all hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-subtle">Webhook Tracking</span>
            <Icon name="activity" className="h-4 w-4 text-ink-faint" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings?.webhookConfigured ? 'Configured' : 'Secret Missing'}
          </p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {settings?.webhookConfigured ? 'Receives tracking updates' : 'Set CJ_WEBHOOK_SECRET in .env'}
          </p>
        </div>
      </div>

      {/* ── STOREFRONT VISIBILITY ── */}
      <SectionCard
        title="Storefront Visibility"
        description="Single global switch: show or hide every CJ-fulfilled product on the customer-facing site."
        actions={
          visibilityNotice ? (
            <Badge tone="success" dot size="sm">
              {visibilityNotice}
            </Badge>
          ) : null
        }
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
            label="Show Dropshipping Products to Customers"
            description="When off, CJ-sourced products disappear from listings, search, related products and product pages on the storefront. Admin and vendor catalog screens are unaffected."
          />
        </div>
      </SectionCard>

      {/* ── AUTOMATED PRICING & AUTO-MARKUP RULES ── */}
      <SectionCard
        title="Automated Pricing & Baseline Markup"
        description="When products are onboarded or imported from CJ Dropshipping, their selling price automatically increases based on these global rules."
        actions={
          markupNotice ? (
            <Badge tone="success" dot size="sm">
              {markupNotice}
            </Badge>
          ) : null
        }
      >
        <form onSubmit={handleSaveMarkup} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Markup Input with Type Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="defaultMarkupValue" className="text-xs font-semibold text-slate-700">
                  {markupType === 'PERCENT' ? 'Baseline Markup (%)' : 'Baseline Markup Amount (₹)'}
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
                description={
                  markupType === 'PERCENT'
                    ? `Selling Price = CJ Cost + (CJ Cost × ${markupValue || 0}%). E.g. 30% on ₹500 cost = ₹650.`
                    : `Selling Price = CJ Cost + ₹${markupValue || 0}. E.g. ₹150 on ₹500 cost = ₹650.`
                }
              />
            </div>

            {/* Price Rounding Rule */}
            <div>
              <Select
                id="priceRoundingRule"
                label="Psychological Price Rounding"
                size="control"
                value={priceRounding}
                onChange={(e) => setPriceRounding(e.target.value)}
                options={[
                  { value: 'ROUND', label: 'Standard Rounding to Integer (e.g., ₹648.70 → ₹649)' },
                  { value: '9_ENDING', label: '9-Ending Charm Pricing (e.g., ₹648.70 → ₹649, ₹1,034 → ₹1,039)' },
                  { value: 'NONE', label: 'Exact Cents / Decimals (e.g., ₹648.70)' },
                ]}
                description="Automatically cleans up storefront selling prices for customer psychology."
              />
            </div>
          </div>

          {/* Dynamic Example Preview */}
          <div className="rounded-md border border-brand-100 bg-brand-50/50 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
                ₹
              </span>
              <div>
                <span className="font-semibold text-slate-900">Live Formula Preview:</span>
                <span className="ml-1 text-ink-subtle">
                  A CJ product with cost <strong>$5.00 (≈ ₹435)</strong> with{' '}
                  <strong>{markupType === 'PERCENT' ? `${markupValue || 0}% markup` : `+₹${markupValue || 0} flat markup`}</strong> will list at{' '}
                  <strong className="text-emerald-700 font-bold">
                    ₹{(() => {
                      const cost = 435;
                      const val = Number(markupValue) || 0;
                      const raw = markupType === 'FLAT' ? cost + val : cost + (cost * (val / 100));
                      if (priceRounding === '9_ENDING') {
                        const rnd = Math.round(raw);
                        return rnd < 10 ? rnd : Math.floor(rnd / 10) * 10 + 9;
                      }
                      if (priceRounding === 'ROUND') return Math.round(raw);
                      return raw.toFixed(2);
                    })()}
                  </strong>
                </span>
              </div>
            </div>

            <Button
              type="submit"
              size="control"
              icon="save"
              isLoading={controller.isUpdatingMarkup}
            >
              Save Pricing Rules
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* ── CONNECTION DETAILS & TELEMETRY ── */}
      <SectionCard
        title="Integration Telemetry"
        description="Health metrics and automated synchronization timestamps with CJ Dropshipping servers."
      >
        <div className="p-4">
          <KeyValueList
            columns={2}
            items={[
              { label: 'Current Status', value: settings?.status || 'DISCONNECTED' },
              { label: 'Environment Mode', value: settings?.environment || 'LIVE' },
              { label: 'Credentials Saved', value: settings?.hasCredentials ? 'Yes (AES-256 Encrypted)' : 'No' },
              { label: 'Last Connection Ping', value: formatDate(settings?.lastConnectionCheckAt) },
              { label: 'Last Successful Call', value: formatDate(settings?.lastSuccessAt) },
              { label: 'Last Failed Attempt', value: formatDate(settings?.lastFailureAt) },
              {
                label: 'Webhook Secret Status',
                value: settings?.webhookConfigured
                  ? 'Configured (Active)'
                  : 'Unset — Set CJ_WEBHOOK_SECRET in server environment',
              },
              {
                label: 'Last Settings Update',
                value: formatDate(settings?.updatedAt),
              },
            ]}
          />
        </div>
      </SectionCard>

      {/* ── MAIN ACTIONS / CONNECT FORM BASED ON AUTH STATE ── */}
      <PermissionGate permission={ADMIN_PERMISSIONS.CJ_SETTINGS}>
        {isConnected ? (
          /* ── CONNECTED STATE: ACTIONS ── */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Account Management Card */}
            <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Account Operations</h2>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Verify connectivity, renew expired auth tokens, or safely disconnect the integration.
                  </p>
                </div>
                <Badge tone="success" dot size="sm">
                  Active
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Action 1: Test */}
                <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-muted/40 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                      <Icon name="live" className="h-4 w-4 text-brand-600" />
                      <span>Test Handshake</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-ink-muted leading-relaxed">
                      Sends a live diagnostic ping to CJ Open Platform API to confirm access.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="control"
                    className="mt-4 w-full"
                    icon="refresh"
                    isLoading={controller.isTesting}
                    onClick={() => controller.testConnection()}
                  >
                    Test Connection
                  </Button>
                </div>

                {/* Action 2: Refresh Token */}
                <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-muted/40 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                      <Icon name="key" className="h-4 w-4 text-brand-600" />
                      <span>Refresh Token</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-ink-muted leading-relaxed">
                      Forces issuance of a fresh access token from the CJ authentication service.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="control"
                    className="mt-4 w-full"
                    icon="refresh"
                    isLoading={controller.isRefreshing}
                    onClick={() => controller.refreshToken()}
                  >
                    Refresh Token
                  </Button>
                </div>

                {/* Action 3: Disconnect */}
                <div className="flex flex-col justify-between rounded-lg border border-danger-100 bg-danger-50/20 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-danger-700 font-semibold text-xs">
                      <Icon name="logout" className="h-4 w-4 text-danger-600" />
                      <span>Disconnect</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-danger-600/80 leading-relaxed">
                      Removes encrypted API keys and stops automated synchronization.
                    </p>
                  </div>
                  <Button
                    variant="dangerOutline"
                    size="control"
                    className="mt-4 w-full"
                    icon="logout"
                    onClick={() => setShowDisconnectModal(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>

            {/* Webhook Configuration Quick Info */}
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm border-b border-border pb-3">
                <Icon name="link" className="h-4 w-4 text-brand-600" />
                <span>CJ Webhook Endpoint</span>
              </div>
              <p className="mt-3 text-xs text-ink-subtle leading-relaxed">
                Add this URL in your CJ Dropshipping developer portal to receive live package tracking, order status, and dispatch events.
              </p>

              <div className="mt-3.5 flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2">
                <code className="text-2xs font-mono text-slate-900 truncate flex-1">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="shrink-0 p-1 text-ink-subtle hover:text-brand-600 transition-colors"
                  title="Copy Webhook URL"
                >
                  <Icon name={copiedWebhook ? 'check' : 'copy'} className="h-4 w-4" />
                </button>
              </div>

              {copiedWebhook && (
                <p className="mt-1.5 text-2xs font-medium text-success-700 flex items-center gap-1">
                  <Icon name="check" className="h-3 w-3" /> Webhook URL copied to clipboard!
                </p>
              )}

              <div className="mt-4 rounded-md bg-brand-50/60 p-3 border border-brand-100">
                <p className="text-2xs font-semibold text-brand-900 flex items-center gap-1.5">
                  <Icon name="shield" className="h-3.5 w-3.5 text-brand-600" />
                  <span>Webhook Security</span>
                </p>
                <p className="mt-1 text-2xs text-brand-800 leading-relaxed">
                  Ensure <code>CJ_WEBHOOK_SECRET</code> is configured on the production backend to cryptographically verify incoming event payloads.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── DISCONNECTED STATE: CONNECT FORM & ONBOARDING GUIDE ── */
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Form Section */}
            <div className="lg:col-span-3 rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-sm">
              <div className="border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 border border-brand-200 font-bold text-xs">
                    CJ
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Connect CJ Dropshipping Account</h2>
                    <p className="text-xs text-ink-subtle">
                      Enter your account email and API Key from the CJ Dropshipping Open Platform.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (form.email && form.apiKey) {
                    controller.connect(form)
                  }
                }}
                className="mt-5 space-y-4"
              >
                {/* Email Field */}
                <div>
                  <Input
                    id="cjEmail"
                    label="CJ Account Email"
                    size="control"
                    type="email"
                    required
                    placeholder="partner@yourcompany.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    description="The registered email address for your CJ Dropshipping account."
                  />
                </div>

                {/* API Key Field */}
                <div>
                  <PasswordInput
                    id="cjApiKey"
                    label="CJ API Key"
                    size="control"
                    required
                    placeholder="Enter your CJ Open Platform API Key"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    description="Generated under My CJ > Authorization > API in developer settings."
                  />
                </div>

                {/* Environment Selector */}
                <div>
                  <Select
                    id="cjEnvironment"
                    label="Environment Mode"
                    size="control"
                    value={form.environment}
                    onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                    options={[
                      { value: 'LIVE', label: 'Live (Production Fulfillment)' },
                      { value: 'SANDBOX', label: 'Sandbox (Testing & Staging)' },
                    ]}
                    description="Choose Live for real wholesale order routing and package delivery."
                  />
                </div>

                {/* Security Assurance Callout */}
                <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 border border-slate-200/80 text-2xs text-ink-muted">
                  <Icon name="lock" className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Your credentials are encrypted with <strong>AES-256-GCM</strong> on the backend before storage and are never exposed to browser sessions.
                  </span>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    size="control"
                    className="w-full sm:w-auto min-w-[160px]"
                    icon="link"
                    isLoading={controller.isConnecting}
                    disabled={!form.email || !form.apiKey}
                  >
                    Connect CJ Account
                  </Button>
                </div>
              </form>
            </div>

            {/* Quick Developer Guide */}
            <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-border pb-3">
                  <Icon name="help" className="h-4 w-4 text-brand-600" />
                  <span>How to retrieve your CJ API Key</span>
                </div>

                <ol className="mt-4 space-y-3.5 text-xs text-ink-subtle">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xs">
                      1
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">Log in to CJ</span>
                      <p className="mt-0.5 text-2xs">
                        Visit <a href="https://cjdropshipping.com" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">cjdropshipping.com</a> and sign in to your master wholesale account.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xs">
                      2
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">Open API Settings</span>
                      <p className="mt-0.5 text-2xs">
                        In the left sidebar, navigate to <strong>Authorization</strong> → <strong>API</strong>.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xs">
                      3
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">Generate &amp; Copy Key</span>
                      <p className="mt-0.5 text-2xs">
                        Generate your developer API key and copy the full key string.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xs">
                      4
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">Paste &amp; Connect</span>
                      <p className="mt-0.5 text-2xs">
                        Paste your email and key into the form on the left and click <strong>Connect CJ Account</strong>.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="mt-6 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center gap-1.5 text-2xs font-semibold text-amber-900">
                  <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
                  <span>Important Note</span>
                </div>
                <p className="mt-1 text-2xs text-amber-800 leading-relaxed">
                  Only platform administrators have access to this page. Vendors and customers do not share or view these wholesale credentials.
                </p>
              </div>
            </div>
          </div>
        )}
      </PermissionGate>

      {/* ── DISCONNECT CONFIRMATION MODAL ── */}
      <Modal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Disconnect CJ Dropshipping Account?"
        description="Are you sure you want to disconnect? Stored API keys will be removed from the server."
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
        <div className="space-y-3 py-2 text-xs text-ink-subtle leading-relaxed">
          <p>
            Disconnecting this account will immediately revoke access to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-800">
            <li>Automatic dropshipping order forwarding to CJ</li>
            <li>Real-time shipment tracking number synchronization</li>
            <li>Direct catalog browsing and product onboarding</li>
          </ul>
          <p className="text-2xs text-danger-600 font-medium pt-1">
            Orders already in transit will keep their recorded tracking numbers. You can reconnect the account at any time.
          </p>
        </div>
      </Modal>
    </PageBody>
  )
}

export default CjSettingsPage
