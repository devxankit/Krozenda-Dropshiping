import { useState } from 'react'
import { Badge, Button, Card, CardBody, Input, Select, Switch } from '../../../../components/ui'
import { InlineAlert } from '../../components/feedback'

// Admin > Dropshipping > Fulfilment.
//
// The three things that decide whether a supplier-shipped order actually
// works: what the buyer is charged for delivery, how long they can change
// their mind, and whether Shopify can tell us what happened afterwards.

const money = (n) => (Number.isFinite(Number(n)) ? `₹${Number(n).toLocaleString('en-IN')}` : '—')

const PUSH_TONE = {
  SCHEDULED: 'neutral',
  PUSHING: 'brand',
  PUSHED: 'success',
  NEEDS_RECONCILE: 'warning',
  FAILED: 'danger',
  ABANDONED: 'danger',
  CANCELLED: 'neutral',
}

const PUSH_HELP = {
  SCHEDULED: 'Waiting for the cancel window to pass.',
  PUSHING: 'Being sent to Shopify right now.',
  PUSHED: 'Shopify has it; the supplier takes over.',
  NEEDS_RECONCILE: 'Outcome unknown — being checked before any retry, so one sale cannot become two supplier orders.',
  FAILED: 'Paid, but Shopify refused it. No supplier has been asked to ship.',
  ABANDONED: 'Paid, but it could not be sent after repeated attempts.',
  CANCELLED: 'Cancelled before it was ever sent.',
}

// ---------------------------------------------------------------------------
function DeliveryRates({ controller }) {
  const rules = controller.settings?.shippingRules || {}
  const [form, setForm] = useState(rules)

  // Re-seed the form when the saved settings arrive or change. Adjusting
  // state during render rather than in an effect: the effect version renders
  // once with stale values first, so a freshly loaded rate would flash the
  // previous one.
  const [seenSettings, setSeenSettings] = useState(controller.settings)
  if (controller.settings !== seenSettings) {
    setSeenSettings(controller.settings)
    setForm(controller.settings?.shippingRules || {})
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const perItem = form.mode === 'PER_ITEM' || form.mode === 'FLAT_PLUS_PER_ITEM'
  const flat = form.mode === 'FLAT_PER_ORDER' || form.mode === 'FLAT_PLUS_PER_ITEM'

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h3 className="font-medium text-slate-800">Delivery charge</h3>
          <p className="mt-1 text-sm text-slate-600">
            Your supplier ships these parcels, so no courier can quote them. These rules are the only source of the
            delivery charge.
          </p>
        </div>

        {!rules.configured && (
          <InlineAlert tone="warning" title="Not configured">
            Until this is switched on, customers cannot check out with supplier-shipped items at all. They are blocked
            deliberately — a delivery charge nobody set would otherwise silently become ₹0.
          </InlineAlert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="How delivery is charged"
            value={form.mode || 'FLAT_PER_ORDER'}
            onChange={(e) => set('mode', e.target.value)}
            options={[
              { value: 'FLAT_PER_ORDER', label: 'One flat charge per order' },
              { value: 'PER_ITEM', label: 'A charge per item' },
              { value: 'FLAT_PLUS_PER_ITEM', label: 'Flat charge plus per item' },
              { value: 'FREE', label: 'Free delivery' },
            ]}
          />
          <Input
            label="Delivery label shown to buyers"
            value={form.label || ''}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Standard delivery"
          />
          {flat && (
            <Input
              label="Flat amount (₹)"
              type="number"
              min="0"
              value={form.flatAmount ?? 0}
              onChange={(e) => set('flatAmount', e.target.value)}
            />
          )}
          {perItem && (
            <Input
              label="Per item (₹)"
              type="number"
              min="0"
              value={form.perItemAmount ?? 0}
              onChange={(e) => set('perItemAmount', e.target.value)}
            />
          )}
          <Input
            label="Free above cart value (₹, 0 = never)"
            type="number"
            min="0"
            value={form.freeAboveCartValue ?? 0}
            onChange={(e) => set('freeAboveCartValue', e.target.value)}
            description="Measured on the goods total after any coupon."
          />
          <Input
            label="Estimated delivery (days)"
            type="number"
            min="1"
            value={form.estimatedDeliveryDays ?? 7}
            onChange={(e) => set('estimatedDeliveryDays', e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Switch
              id="shopify-rates-configured"
              checked={form.configured === true}
              onChange={(e) => set('configured', e.target.checked)}
            />
            These rates are set and may be charged
          </label>
          <Button
            onClick={() =>
              controller.saveSettings({
                shippingRules: {
                  ...form,
                  flatAmount: Number(form.flatAmount) || 0,
                  perItemAmount: Number(form.perItemAmount) || 0,
                  freeAboveCartValue: Number(form.freeAboveCartValue) || 0,
                  estimatedDeliveryDays: Number(form.estimatedDeliveryDays) || 7,
                },
              })
            }
            loading={controller.isSaving}
          >
            Save delivery rates
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
function CancelWindow({ controller }) {
  const [minutes, setMinutes] = useState(controller.settings?.orderPushGraceMinutes ?? 15)
  const [testMode, setTestMode] = useState(controller.settings?.pushAsTestOrders === true)

  // Same reason as above: seeded during render, not from an effect.
  const [seenSettings, setSeenSettings] = useState(controller.settings)
  if (controller.settings !== seenSettings) {
    setSeenSettings(controller.settings)
    setMinutes(controller.settings?.orderPushGraceMinutes ?? 15)
    setTestMode(controller.settings?.pushAsTestOrders === true)
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h3 className="font-medium text-slate-800">Cancel window</h3>
          <p className="mt-1 text-sm text-slate-600">
            How long a paid order is held before it is sent to Shopify. Inside this window a customer can cancel for
            free — nothing has been ordered from the supplier yet, so there is nothing to unwind.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Hold orders for (minutes)"
            type="number"
            min="0"
            max="1440"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            description={Number(minutes) === 0 ? 'Zero sends immediately — customers cannot self-cancel.' : ''}
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <label className="flex items-start gap-2 text-sm text-amber-900">
            <Switch id="shopify-test-orders" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            <span>
              <span className="font-medium">Send orders to Shopify as test orders</span>
              <br />
              For trying the flow end to end without a supplier shipping anything real. Leave this off to take real
              orders.
            </span>
          </label>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button
            onClick={() =>
              controller.saveSettings({
                orderPushGraceMinutes: Number(minutes),
                pushAsTestOrders: testMode,
              })
            }
            loading={controller.isSaving}
          >
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
function Webhooks({ controller }) {
  const { webhooks, webhooksError } = controller
  const [baseUrl, setBaseUrl] = useState('')
  const healthy = webhooks?.healthy === true
  const missing = webhooks?.missing || []

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-slate-800">Updates from Shopify</h3>
            <p className="mt-1 text-sm text-slate-600">
              How tracking numbers, delivery status and stock changes get back to Krozenda.
            </p>
          </div>
          <Badge tone={healthy ? 'success' : 'danger'}>{healthy ? 'Receiving updates' : 'Not receiving updates'}</Badge>
        </div>

        {webhooksError && (
          <InlineAlert tone="danger" title="Could not read subscriptions">
            {webhooksError?.response?.data?.message || webhooksError.message}
          </InlineAlert>
        )}

        {!healthy && !webhooksError && (
          <InlineAlert tone="danger" title="Orders go out, but nothing comes back">
            {missing.length === (webhooks?.subscriptions?.length === 0 ? missing.length : -1) || !webhooks?.callbackUrl
              ? 'Shopify is not sending anything to Krozenda. Orders will reach your supplier, but tracking numbers, delivery updates and stock changes will never arrive.'
              : `Missing ${missing.length} subscription(s): ${missing.join(', ')}.`}
          </InlineAlert>
        )}

        {webhooks?.callbackUrl && (
          <div className="text-sm">
            <span className="text-slate-500">Shopify sends to </span>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{webhooks.callbackUrl}</code>
            {webhooks.registeredAt && (
              <span className="text-slate-500"> · since {new Date(webhooks.registeredAt).toLocaleString()}</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Public address of this server"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.krozenda.com"
            className="w-72"
            description="Must be public HTTPS. Shopify cannot reach localhost — use a tunnel in development."
          />
          <Button onClick={() => controller.registerWebhooks(baseUrl || undefined)} loading={controller.isRegistering}>
            {healthy ? 'Re-subscribe' : 'Subscribe'}
          </Button>
          {webhooks?.subscriptions?.length > 0 && (
            <Button variant="ghost" onClick={() => controller.unregisterWebhooks()} loading={controller.isUnregistering}>
              Remove
            </Button>
          )}
        </div>

        {webhooks?.subscriptions?.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">
              {webhooks.subscriptions.length} subscription(s)
            </summary>
            <ul className="mt-2 space-y-1 text-slate-600">
              {webhooks.subscriptions.map((s) => (
                <li key={s.id} className="font-mono text-xs">
                  {s.topic}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
function OrderPushes({ controller }) {
  const { pushes, pushCounts } = controller
  // A paid order that never reached the supplier is the one thing here worth
  // interrupting someone for.
  const stuck = (pushCounts.FAILED || 0) + (pushCounts.ABANDONED || 0)

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-slate-800">Orders going to Shopify</h3>
            <p className="mt-1 text-sm text-slate-600">
              Every paid order waiting for, or already sent to, your supplier.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => controller.syncNow()} loading={controller.isSyncing}>
              Sync stock now
            </Button>
            <Button variant="secondary" onClick={() => controller.runPushesNow()} loading={controller.isRunning}>
              Send due orders now
            </Button>
          </div>
        </div>

        {stuck > 0 && (
          <InlineAlert tone="danger" title={`${stuck} paid order(s) did not reach Shopify`}>
            These customers have paid, but no supplier has been asked to ship. Retry them, or cancel and refund.
          </InlineAlert>
        )}

        <div className="flex flex-wrap gap-2">
          {['', 'SCHEDULED', 'PUSHED', 'NEEDS_RECONCILE', 'FAILED', 'ABANDONED', 'CANCELLED'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => controller.setPushStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                controller.pushStatus === s
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {s || 'All'}
              {s && pushCounts[s] ? ` (${pushCounts[s]})` : ''}
            </button>
          ))}
        </div>

        {controller.isLoadingPushes ? (
          <div className="py-8 text-center text-slate-500">Loading…</div>
        ) : pushes.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            No orders yet. They appear here as soon as a customer pays for a supplier-shipped item.
          </div>
        ) : (
          <div className="space-y-2">
            {pushes.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={PUSH_TONE[p.status] || 'neutral'}>{p.status}</Badge>
                    <span className="font-mono text-xs text-slate-500">
                      ORD-{String(p.orderId).slice(-8).toUpperCase()}
                    </span>
                    <span className="text-sm text-slate-700">{money(p.orderTotal)}</span>
                    {p.test && <Badge tone="warning">test</Badge>}
                    {p.shopifyOrderName && <Badge tone="neutral">{p.shopifyOrderName}</Badge>}
                  </div>
                  {['FAILED', 'ABANDONED', 'NEEDS_RECONCILE'].includes(p.status) && (
                    <Button variant="secondary" onClick={() => controller.retryPush(p.orderId)} loading={controller.isRetrying}>
                      Retry
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{PUSH_HELP[p.status]}</p>
                {p.lastError && <p className="mt-1 text-xs text-rose-600">{p.lastError}</p>}
                {p.status === 'SCHEDULED' && p.dueAt && (
                  <p className="mt-1 text-xs text-slate-500">Sends at {new Date(p.dueAt).toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
export function FulfilmentTab({ controller }) {
  if (controller.isLoading) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="space-y-4">
      <Webhooks controller={controller} />
      <OrderPushes controller={controller} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DeliveryRates controller={controller} />
        <CancelWindow controller={controller} />
      </div>
    </div>
  )
}

export default FulfilmentTab
