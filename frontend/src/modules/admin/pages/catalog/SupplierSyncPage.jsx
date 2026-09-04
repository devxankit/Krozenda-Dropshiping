import { Badge, Button, Table } from '../../../../components/ui'
import { SYNC_RUN_COLUMNS } from '../../tableColumns/catalogColumns'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { INTEGRATION_HEALTH_LABELS, INTEGRATION_HEALTH_TONE } from '../../constants'
import { useSupplierSyncController } from '../../controllers/useCatalogController'

export function SupplierSyncPage() {
  const { data, isLoading, error, refetch } = useSupplierSyncController()

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
        title="Supplier sync"
        description="Two supplier integrations are in scope for Phase 1. Each additional supplier is a new adapter, not a new codebase."
        actions={
          <Button variant="secondary" size="control" icon="refresh">
            Run all now
          </Button>
        }
      />

      <InlineAlert tone="info" title="Adapters sit behind one interface">
        Stock, price, image and description sync are declared per adapter. A supplier that only
        exposes stock and price simply declares fewer capabilities — no code branches on the
        supplier name.
      </InlineAlert>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.adapters.map((adapter) => (
          <SectionCard
            key={adapter.id}
            title={adapter.name}
            actions={
              <Badge tone={INTEGRATION_HEALTH_TONE[adapter.status]} dot>
                {INTEGRATION_HEALTH_LABELS[adapter.status]}
              </Badge>
            }
          >
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-subtle">Products tracked</span>
                <span className="tabular font-semibold text-slate-900">
                  {adapter.productsTracked.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-subtle">Last run</span>
                <span className="text-slate-900">{adapter.lastRunAt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-3">
                <span className="text-2xs uppercase tracking-wider text-ink-faint">Syncs</span>
                {adapter.syncs.map((sync) => (
                  <Badge key={sync} tone="neutral" size="sm">
                    {sync}
                  </Badge>
                ))}
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Recent runs" description="Nightly at 02:00 IST, plus manual runs">
        <Table
          className="rounded-none border-0 border-t"
          columns={SYNC_RUN_COLUMNS}
          data={data.runs}
          getRowKey={(run) => run.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}
