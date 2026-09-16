import { useMemo, useState } from 'react'
import { Button, Input, Select, Textarea } from '../../../../components/ui'
import { ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { Drawer } from '../../components/overlay/Drawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { COMMISSION_SCOPE_LABELS, ADMIN_PERMISSIONS } from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useCommissionOptionsController,
  useCommissionRuleListController,
  useCommissionRuleWriteController,
} from '../../controllers/useAccountingController'

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
  { value: 'FIXED', label: 'Fixed amount per line' },
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
          label={form.type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹ per line)'}
          required
          inputMode="decimal"
          value={form.value}
          onChange={set('value')}
          error={overLimit ? `The platform limit is ${policy.maxCommissionPercent}%` : undefined}
          description={
            form.type === 'PERCENTAGE' && policy
              ? `Charged on: ${policy.commissionBase.toLowerCase().replace(/_/g, ' ')}`
              : 'A fixed fee can never exceed the line it is charged on.'
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

export function CommissionsPage() {
  const list = useCommissionRuleListController()
  const writer = useCommissionRuleWriteController()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [retiring, setRetiring] = useState(null)

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
          <PermissionGate permission={MANAGE}>
            <Button size="control" icon="add" onClick={() => setCreating(true)}>
              New rule
            </Button>
          </PermissionGate>
        }
        banner={
          rulePolicy && (
            <InlineAlert tone="info" title="How a rate is chosen">
              Product → Seller → Category → Global, then the seller&rsquo;s own rate, then the platform
              default of {rulePolicy.defaultCommissionPercent}%. Nothing may exceed{' '}
              {rulePolicy.maxCommissionPercent}%. Editing a rule never changes what past orders were
              charged.
            </InlineAlert>
          )
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
            ? `Without a rule, every seller is charged their own rate or the platform default of ${rulePolicy.defaultCommissionPercent}%.`
            : 'Add a rule to override the platform default.'
        }
      />

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
