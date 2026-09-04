import { Badge, Button, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import {
  COMMISSION_RULE_COLUMNS,
  PRICE_TIER_COLUMNS,
  SCOPE_ORDER,
} from '../../tableColumns/financeColumns'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useCommissionRulesController,
  usePricingRulesController,
} from '../../controllers/useFinanceController'

export function CommissionRulesPage() {
  const { data, isLoading, error, refetch } = useCommissionRulesController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const sorted = [...data.items].sort(
    (a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope),
  )

  return (
    <PageBody>
      <PageHeader
        title="Commission rules"
        description="Product → vendor → category → company → default. The most specific rule that matches wins."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.FINANCE_MANAGE}>
            <Button size="control" icon="add">
              New rule
            </Button>
          </PermissionGate>
        }
      />

      <InlineAlert tone="warning" title="Changing a rate does not change existing orders">
        Commission is snapshotted onto each sub-order when the order is placed. Editing a rule
        here affects orders placed from the moment you save, and nothing before it.
      </InlineAlert>

      <SectionCard
        title="Rules in resolution order"
        description="The number beside each scope is its priority — 1 is checked first"
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={COMMISSION_RULE_COLUMNS}
          data={sorted}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}

export function PricingRulesPage() {
  const { data, isLoading, error, refetch } = usePricingRulesController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Pricing rules"
        description="Price levels by buyer role, and the discount and shipping rules layered over them."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.FINANCE_MANAGE}>
            <Button size="control" icon="add">
              New rule
            </Button>
          </PermissionGate>
        }
      />

      <SectionCard
        title="Price tiers"
        description="A buyer's role decides which tier resolves when a cart line is added"
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={PRICE_TIER_COLUMNS}
          data={data.tiers}
          getRowKey={(row) => row.role}
          density="compact"
        />
      </SectionCard>

      <SectionCard title="Rules" description="Applied after the tier price resolves">
        <ul className="divide-y divide-border-subtle">
          {data.rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-4 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">{rule.name}</span>
                  <Badge tone="neutral" size="sm">
                    {rule.kind}
                  </Badge>
                </span>
                <span className="mt-0.5 block text-2xs text-ink-subtle">
                  When {rule.condition} → {rule.effect}
                </span>
              </span>
              <Switch id={rule.id} checked={rule.active} onChange={() => {}} />
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageBody>
  )
}
