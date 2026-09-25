import { useMemo, useState } from 'react'
import { Button, Input, Select, Textarea } from '../../../../components/ui'
import { ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { Drawer } from '../../components/overlay/Drawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { SectionCard } from '../../components/display'
import { SummaryCard } from '../../components/accounting/AccountingShell'
import { getErrorMessage } from '../../../../lib/toast'
import { COMMISSION_SCOPE_LABELS, ADMIN_PERMISSIONS } from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useAccountingConfigController,
  useAccountingConfigWriteController,
  useCommissionOptionsController,
  useCommissionPreviewController,
  useCommissionRuleListController,
  useCommissionSummaryController,
  useCommissionRuleWriteController,
} from '../../controllers/useAccountingController'

const SETTLEMENT_MODE_OPTIONS = [
  { value: 'AUTO', label: 'Automatic — released on schedule' },
  { value: 'MANUAL', label: 'Manual — an admin releases each transfer' },
]

// This is AccountingConfig (backend/Models/AccountingConfig.js) — the real
// ledger's policy record, which this screen already surfaces via the
// commission `policy` banner below. It is a different record from the
// legacy Finance module's platform_configurations (Settings → Business
// rules), which this page does not touch.
//
// Note: as of this sub-task, adminCommissionController's serializeConfig /
// updateAccountingConfig whitelist do not yet read or accept
// sellerSettlementMode / sellerSettlementWindowDays even though the model
// carries them — see AccountingConfig.js. This panel is wired to the real
// config endpoint and will start working the moment that whitelist is
// extended; until then saving here is a no-op on the backend.
function SellerSettlementAutomationCard() {
  const config = useAccountingConfigController()
  if (!config.data) return null
  // Keyed on the loaded config below so a save (which refetches it) starts
  // this form fresh from the new server state, the same way RuleFormDrawer
  // above is keyed on the row it edits.
  return <SellerSettlementAutomationForm key={config.data.updatedAt} config={config.data} />
}

function SellerSettlementAutomationForm({ config }) {
  const writer = useAccountingConfigWriteController()
  const [mode, setMode] = useState(config.sellerSettlementMode || 'MANUAL')
  const [windowDays, setWindowDays] = useState(String(config.sellerSettlementWindowDays ?? ''))

  const dirty =
    mode !== (config.sellerSettlementMode || 'MANUAL') ||
    windowDays !== String(config.sellerSettlementWindowDays ?? '')

  return (
    <SectionCard
      title="Seller settlement automation"
      description="Whether Razorpay Route transfers for eligible settlements go out on their own, or wait for an admin to release them."
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <Select
          id="seller-settlement-mode"
          label="Mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={SETTLEMENT_MODE_OPTIONS}
        />
        <Input
          id="seller-settlement-window-days"
          label="Window (days)"
          type="number"
          min={0}
          value={windowDays}
          onChange={(event) => setWindowDays(event.target.value)}
          description="How long after eligibility AUTO waits before releasing."
        />
        <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE}>
          <Button
            size="control"
            disabled={!dirty}
            isLoading={writer.isSubmitting}
            onClick={() =>
              writer.run({
                sellerSettlementMode: mode,
                sellerSettlementWindowDays: Number(windowDays) || 0,
              })
            }
          >
            Save
          </Button>
        </PermissionGate>
      </div>
    </SectionCard>
  )
}

// /admin/accounting/commissions — what the marketplace charges.
//
// The thing this screen has to communicate, and the reason the "Already
// charged" column exists: editing a rule changes what FUTURE orders are
// charged and never what past ones were. The rate that applied is frozen onto
// each commission entry at the moment it was posted.

const MANAGE = ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE

const SCOPE_OPTIONS = Object.entries(COMMISSION_SCOPE_LABELS).map(([value, label]) => ({ value, label }))
const TYPE_OPTIONS = [
  { value: 'PERCENTAGE', label: 'Percentage of the sale' },
  { value: 'FIXED', label: 'Fixed amount per unit sold' },
]

const blankRule = () => ({
  name: '',
  type: 'PERCENTAGE',
  value: '',
  scope: 'GLOBAL',
  sellerId: '',
  categoryId: '',
  productId: '',
  startDate: '',
  endDate: '',
  priority: 0,
  notes: '',
})

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '')

function RuleFormDrawer({ isOpen, onClose, rule, policy }) {
  const isEditing = Boolean(rule)
  const [form, setForm] = useState(() =>
    rule
      ? {
          name: rule.name,
          type: rule.type,
          value: String(rule.value),
          scope: rule.scope,
          sellerId: rule.sellerId || '',
          categoryId: rule.categoryId || '',
          productId: rule.productId || '',
          startDate: toDateInput(rule.startDate),
          endDate: toDateInput(rule.endDate),
          priority: rule.priority,
          notes: rule.notes || '',
        }
      : blankRule(),
  )
  const [productSearch, setProductSearch] = useState('')
  const options = useCommissionOptionsController(productSearch)
  const writer = useCommissionRuleWriteController({ onSaved: onClose })

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const numericValue = Number(form.value)
  const overLimit = form.type === 'PERCENTAGE' && numericValue > (policy?.maxCommissionPercent ?? 100)
  const needsTarget = form.scope !== 'GLOBAL'
  const targetKey = { SELLER: 'sellerId', CATEGORY: 'categoryId', PRODUCT: 'productId' }[form.scope]
  const isValid =
    form.name.trim().length > 0 &&
    Number.isFinite(numericValue) &&
    numericValue >= 0 &&
    !overLimit &&
    (!needsTarget || Boolean(form[targetKey]))

  function submit() {
    if (!isValid) return
    const payload = {
      name: form.name.trim(),
      type: form.type,
      value: numericValue,
      scope: form.scope,
      // Only the target the scope actually uses is sent; the backend rejects
      // a rule that names more than one.
      sellerId: form.scope === 'SELLER' ? form.sellerId : undefined,
      categoryId: form.scope === 'CATEGORY' ? form.categoryId : undefined,
      productId: form.scope === 'PRODUCT' ? form.productId : undefined,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      priority: Number(form.priority) || 0,
      notes: form.notes.trim(),
    }
    if (isEditing) writer.update.run({ id: rule.id, ...payload })
    else writer.create.run(payload)
  }

  const isSubmitting = writer.create.isSubmitting || writer.update.isSubmitting

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit commission rule' : 'New commission rule'}
      description={
        isEditing
          ? 'Changes apply to orders charged from now on. Orders already charged keep their rate.'
          : 'The most specific matching rule wins: product, then seller, then category, then global.'
      }
      width="md"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="control" onClick={submit} disabled={!isValid || isSubmitting} isLoading={isSubmitting}>
            {isEditing ? 'Save rule' : 'Create rule'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 p-5">
        {isEditing && rule.appliedCount > 0 && (
          <InlineAlert tone="info" title={`This rule has already charged ${rule.appliedCount} order line(s)`}>
            Those commission entries keep the rate they were posted with — editing here cannot
            restate them.
          </InlineAlert>
        )}

        <Input
          id="rule-name"
          label="Name"
          required
          placeholder="Electronics standard rate"
          value={form.name}
          onChange={set('name')}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="rule-scope" label="Scope" required value={form.scope} onChange={set('scope')} options={SCOPE_OPTIONS} />
          <Select id="rule-type" label="Type" required value={form.type} onChange={set('type')} options={TYPE_OPTIONS} />
        </div>

        {form.scope === 'SELLER' && (
          <Select
            id="rule-seller"
            label="Seller"
            required
            value={form.sellerId}
            onChange={set('sellerId')}
            placeholder="Select a seller"
            options={options.data?.sellers || []}
          />
        )}
        {form.scope === 'CATEGORY' && (
          <Select
            id="rule-category"
            label="Category"
            required
            value={form.categoryId}
            onChange={set('categoryId')}
            placeholder="Select a category"
            options={options.data?.categories || []}
          />
        )}
        {form.scope === 'PRODUCT' && (
          <div className="flex flex-col gap-2">
            <Input
              id="rule-product-search"
              label="Find a product"
              placeholder="Type at least part of the name"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              icon="search"
            />
            <Select
              id="rule-product"
              label="Product"
              required
              value={form.productId}
              onChange={set('productId')}
              placeholder={productSearch ? 'Select a product' : 'Search for a product first'}
              options={options.data?.products || []}
            />
          </div>
        )}

        <Input
          id="rule-value"
          label={form.type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹ per unit)'}
          required
          inputMode="decimal"
          value={form.value}
          onChange={set('value')}
          error={overLimit ? `The platform limit is ${policy.maxCommissionPercent}%` : undefined}
          description={
            form.type === 'PERCENTAGE' && policy
              ? `Charged on: ${policy.commissionBase.toLowerCase().replace(/_/g, ' ')}`
              : 'Charged once per unit sold, and never more than the line it is charged on.'
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="rule-start" label="Starts" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input
            id="rule-end"
            label="Ends"
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={set('endDate')}
          />
        </div>

        <Input
          id="rule-priority"
          label="Priority"
          type="number"
          value={form.priority}
          onChange={set('priority')}
          description="Higher wins. Equal priorities fall back to the most specific scope."
        />

        <Textarea id="rule-notes" label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
      </div>
    </Drawer>
  )
}

// Where the commission the marketplace has charged stands now. Every figure is
// the backend's aggregation over the ledger — there is no separate commission
// status to drift out of step with it.
function CommissionSummaryCard() {
  const summary = useCommissionSummaryController()
  const data = summary.data
  if (!data) return null
  return (
    <SummaryCard
      title="Commission"
      description="Net of everything handed back on refunds and cancellations"
      columns={4}
      rows={[
        { label: 'Net commission', value: data.netCommission },
        { label: 'This month', value: data.thisMonth },
        { label: 'Last month', value: data.lastMonth, tone: 'muted' },
        { label: 'Total charged', value: data.totalCharged, tone: 'muted' },
        { label: 'Earned (delivered)', value: data.earned, tone: 'positive' },
        { label: 'Pending (not delivered)', value: data.pending },
        { label: 'Reversed (refunds)', value: data.reversed, tone: 'negative' },
        { label: 'Cancelled', value: data.cancelled, tone: 'negative' },
      ]}
    />
  )
}

const FUNDED_BY_OPTIONS = [
  { value: 'SELLER', label: 'The seller (their own coupon)' },
  { value: 'PLATFORM', label: 'The platform (a platform promotion)' },
]

const SCOPE_NAME = { ...COMMISSION_SCOPE_LABELS, DEFAULT: 'Platform default' }

const describeTerms = (type, value) => (type === 'FIXED' ? `₹${value} per unit` : `${value}%`)

// "What would this be charged?" — the same resolver and commission base the
// ledger posts with, on a product the admin picks. Nothing is saved.
function PreviewDrawer({ isOpen, onClose }) {
  const [productSearch, setProductSearch] = useState('')
  const [form, setForm] = useState({
    productId: '',
    sellingPrice: '',
    discount: '',
    discountFundedBy: 'SELLER',
    quantity: '1',
  })
  const options = useCommissionOptionsController(productSearch)
  const preview = useCommissionPreviewController()
  const result = preview.result

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  function submit() {
    if (!form.productId) return
    preview.run({
      productId: form.productId,
      // Blank means "the product's own price".
      sellingPrice: form.sellingPrice === '' ? undefined : Number(form.sellingPrice),
      discount: form.discount === '' ? 0 : Number(form.discount),
      discountFundedBy: form.discountFundedBy,
      quantity: Number(form.quantity) || 1,
    })
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Preview commission"
      description="What an order for this product placed right now would be charged. Nothing is saved."
      width="md"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose}>
            Close
          </Button>
          <Button size="control" onClick={submit} disabled={!form.productId} isLoading={preview.isSubmitting}>
            Calculate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 p-5">
        <Input
          id="preview-product-search"
          label="Find a product"
          placeholder="Type at least part of the name"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          icon="search"
        />
        <Select
          id="preview-product"
          label="Product"
          required
          value={form.productId}
          onChange={set('productId')}
          placeholder={productSearch ? 'Select a product' : 'Search for a product first'}
          options={options.data?.products || []}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            id="preview-price"
            label="Price (₹/unit)"
            inputMode="decimal"
            placeholder="Product price"
            value={form.sellingPrice}
            onChange={set('sellingPrice')}
          />
          <Input
            id="preview-discount"
            label="Discount (₹/unit)"
            inputMode="decimal"
            placeholder="0"
            value={form.discount}
            onChange={set('discount')}
          />
          <Input
            id="preview-quantity"
            label="Quantity"
            type="number"
            min={1}
            value={form.quantity}
            onChange={set('quantity')}
          />
        </div>
        <Select
          id="preview-funded-by"
          label="Discount funded by"
          value={form.discountFundedBy}
          onChange={set('discountFundedBy')}
          options={FUNDED_BY_OPTIONS}
        />

        {preview.error && (
          <InlineAlert tone="danger" title="Could not calculate">
            {getErrorMessage(preview.error)}
          </InlineAlert>
        )}

        {result && (
          <>
            <SummaryCard
              title={result.productName || 'Result'}
              description={`${SCOPE_NAME[result.source]} — ${result.ruleName}`}
              rows={[
                { label: 'Gross', value: result.grossAmount },
                { label: 'Discount', value: result.discount, tone: 'muted' },
                {
                  label: `Commission base (${result.commissionBasis.toLowerCase().replace(/_/g, ' ')})`,
                  value: result.commissionBase,
                },
                {
                  label: `Commission (${describeTerms(result.commissionType, result.commissionValue)})`,
                  value: result.commissionAmount,
                  tone: 'negative',
                },
                { label: 'Seller payable', value: result.sellerPayable, tone: 'positive' },
              ]}
              footer="Seller payable is before gateway fees, shipping and any later refund."
            />

            <SectionCard title="How the rate was chosen" description="Every step, including the ones that did not apply">
              <ol className="flex flex-col divide-y divide-border-subtle px-4 py-1 text-xs">
                {result.chain.map((step) => (
                  <li key={step.scope} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className={step.applies ? 'font-semibold text-brand-700' : 'text-ink-subtle'}>
                      {SCOPE_NAME[step.scope]}
                      {step.applies && ' — applied'}
                      {step.ruleName && step.scope !== 'DEFAULT' && (
                        <span className="block text-2xs font-normal text-ink-faint">{step.ruleName}</span>
                      )}
                    </span>
                    <span className={`tabular ${step.applies ? 'font-bold text-brand-700' : 'text-ink-subtle'}`}>
                      {step.value === null ? 'Not set' : describeTerms(step.type, step.value)}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </>
        )}
      </div>
    </Drawer>
  )
}

export function CommissionsPage() {
  const list = useCommissionRuleListController()
  const writer = useCommissionRuleWriteController()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [retiring, setRetiring] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  // The platform's fallback rate and ceiling ride along on the list response
  // rather than costing a second request.
  const rulePolicy = list.data?.policy

  const rows = list.items.map((row, index) => ({
    ...row,
    sn: (list.page - 1) * list.rowsPerPage + index + 1,
  }))

  const cols = useMemo(
    () =>
      withRowActions(columns.COMMISSION_COLUMNS, (row) => [
        {
          label: 'Edit rule',
          icon: 'edit',
          permission: MANAGE,
          onSelect: () => setEditing(row),
        },
        {
          label: row.isActive ? 'Retire rule' : 'Activate rule',
          icon: row.isActive ? 'close' : 'check',
          tone: row.isActive ? 'danger' : undefined,
          permission: MANAGE,
          onSelect: () =>
            row.isActive
              ? setRetiring(row)
              : writer.setStatus.run({ id: row.id, isActive: true }),
        },
      ]),
    [writer.setStatus],
  )

  return (
    <>
      <ListScreen
        title="Commissions"
        description="What the marketplace charges, and on what. The most specific matching rule wins."
        actions={
          <>
            <Button variant="secondary" size="control" icon="search" onClick={() => setPreviewing(true)}>
              Preview
            </Button>
            <PermissionGate permission={MANAGE}>
              <Button size="control" icon="add" onClick={() => setCreating(true)}>
                New rule
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          <>
            <CommissionSummaryCard />
            <SellerSettlementAutomationCard />
            {rulePolicy && (
              <InlineAlert tone="info" title="How a rate is chosen">
                Product → Seller → Category → Global, then the platform default of{' '}
                {rulePolicy.defaultCommissionPercent}%. Nothing may exceed {rulePolicy.maxCommissionPercent}%.
                The terms are frozen onto each order line at checkout, so editing a rule never changes
                what an order already placed is charged.
              </InlineAlert>
            )}
          </>
        }
        controller={{ ...list, items: rows }}
        columns={cols}
        filters={columns.COMMISSION_FILTERS}
        tabs={columns.COMMISSION_TABS}
        searchPlaceholder="Rule name or target…"
        itemLabel="rules"
        emptyIcon="sliders"
        emptyTitle="No commission rules"
        emptyDescription={
          rulePolicy
            ? `Without a rule, every seller is charged the platform default of ${rulePolicy.defaultCommissionPercent}%.`
            : 'Add a rule to override the platform default.'
        }
      />

      {previewing && <PreviewDrawer isOpen onClose={() => setPreviewing(false)} />}

      {creating && (
        <RuleFormDrawer isOpen onClose={() => setCreating(false)} rule={null} policy={rulePolicy} />
      )}
      {editing && (
        // Keyed so switching rows rebuilds the form rather than showing the
        // previous rule's values.
        <RuleFormDrawer
          key={editing.id}
          isOpen
          onClose={() => setEditing(null)}
          rule={editing}
          policy={rulePolicy}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(retiring)}
        onClose={() => setRetiring(null)}
        title="Retire this rule?"
        description="It stops applying to new orders. Commission already charged under it is unaffected, and the rule stays on the record so those charges can still be explained."
        confirmLabel="Retire rule"
        isSubmitting={writer.setStatus.isSubmitting}
        onConfirm={() => {
          writer.setStatus.run({ id: retiring.id, isActive: false })
          setRetiring(null)
        }}
      />
    </>
  )
}
