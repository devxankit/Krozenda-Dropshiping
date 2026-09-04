import { Badge, Icon, Table } from '../../../../components/ui'
import { MoneyCell, SectionCard } from '../display'

// The resolution order from project context §6.5, drawn as the chain it is:
// product → vendor → category → company → default, most specific wins. Showing
// the whole chain — including the steps that did NOT apply — is the point; it
// answers "why is this rate 12.5%" without opening the rules screen.
export function CommissionChain({ commission }) {
  return (
    <SectionCard
      title="Commission that will apply"
      description="Resolved most-specific-first, then snapshotted onto each sub-order at the time of the order"
    >
      <div className="flex flex-wrap items-stretch gap-1.5 p-4">
        {commission.chain.map((step, index) => (
          <div key={step.scope} className="flex flex-1 items-center gap-1.5">
            <div
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 ${
                step.applies ? 'border border-brand-200 bg-brand-50' : ''
              }`}
            >
              <p
                className={`text-2xs font-semibold uppercase tracking-wider ${step.applies ? 'text-brand-600' : 'text-ink-faint'}`}
              >
                {step.scope}
                {step.applies && ' — applies'}
              </p>
              <p
                className={`tabular mt-1 truncate text-xs ${
                  step.applies
                    ? 'font-bold text-brand-700'
                    : step.value === null
                      ? 'text-ink-faint'
                      : 'text-ink-subtle'
                }`}
              >
                {step.value === null ? 'Not set' : `${step.value}% of net`}
              </p>
              {step.applies && <p className="mt-0.5 truncate text-2xs text-brand-600">{step.label}</p>}
            </div>
            {index < commission.chain.length - 1 && (
              <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

const TIER_COLUMNS = Object.freeze([
  { key: 'label', header: 'Buyer role', cellClassName: 'font-medium text-slate-900' },
  {
    key: 'mrp',
    header: 'MRP',
    width: '7rem',
    align: 'right',
    render: (tier) => <MoneyCell amount={tier.mrp} muted />,
  },
  {
    key: 'price',
    header: 'Selling price',
    width: '8rem',
    align: 'right',
    render: (tier) => <MoneyCell amount={tier.price} />,
  },
  { key: 'minQty', header: 'Min qty', width: '6rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'margin',
    header: 'Margin',
    width: '6.5rem',
    align: 'right',
    render: (tier) => (
      <span
        className={`tabular font-semibold ${tier.margin < 8 ? 'text-danger-700' : 'text-success-700'}`}
      >
        {tier.margin}%
      </span>
    ),
  },
])

export function PriceTierTable({ tiers = [], actions }) {
  return (
    <SectionCard
      title="Price tiers by buyer role"
      description="The tier a buyer sees is resolved from their role when the cart line is added"
      actions={actions}
    >
      <Table
        className="rounded-none border-0 border-t"
        columns={TIER_COLUMNS}
        data={tiers}
        getRowKey={(tier) => tier.role}
        density="compact"
      />
    </SectionCard>
  )
}

const INVENTORY_COLUMNS = Object.freeze([
  {
    key: 'location',
    header: 'Location',
    render: (row) => (
      <span className="block">
        <span className="block font-medium text-slate-900">{row.location}</span>
        <span className="block text-2xs text-ink-faint">{row.bucket}</span>
      </span>
    ),
  },
  { key: 'onHand', header: 'On hand', width: '6rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'reserved',
    header: 'Reserved',
    width: '6rem',
    align: 'right',
    cellClassName: 'tabular text-ink-subtle',
  },
  {
    key: 'available',
    header: 'Available',
    width: '6.5rem',
    align: 'right',
    cellClassName: 'tabular font-semibold text-slate-900',
  },
])

export function ProductInventoryTable({ inventory = [] }) {
  return (
    <SectionCard title="Inventory" description="Reserved quantity is held by orders not yet packed">
      <Table
        className="rounded-none border-0 border-t"
        columns={INVENTORY_COLUMNS}
        data={inventory}
        getRowKey={(row) => `${row.bucket}-${row.location}`}
        density="compact"
      />
    </SectionCard>
  )
}

// The approval chain as a badge trio — category, then brand, then product.
// Order matters: each is blocked until the one before it clears.
export function ApprovalChainBadges({ steps = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <span key={step.label} className="flex items-center gap-1.5">
          {index > 0 && <Icon name="chevronRight" className="h-3 w-3 text-border-strong" />}
          <Badge tone={step.done ? 'success' : step.tone === 'warning' ? 'warning' : 'neutral'} size="sm" dot>
            {step.label}
          </Badge>
        </span>
      ))}
    </div>
  )
}
