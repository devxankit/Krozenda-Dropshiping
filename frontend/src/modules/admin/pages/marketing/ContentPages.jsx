import { Badge, Button, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { BANNER_COLUMNS, CMS_COLUMNS } from '../../tableColumns/marketingColumns'
import {
  useBannersController,
  useCmsPagesController,
  useOffersController,
  useTemplatesController,
} from '../../controllers/useMarketingController'

const DLT_TONE = { approved: 'success', pending: 'warning', rejected: 'danger', not_required: 'neutral' }
const DLT_LABEL = {
  approved: 'DLT approved',
  pending: 'DLT pending',
  rejected: 'DLT rejected',
  not_required: 'Not applicable',
}

function Guard({ controller, children }) {
  if (controller.isLoading) return <PageSkeleton rows={3} />
  if (controller.error) return <ErrorState error={controller.error} onRetry={controller.refetch} />
  return children(controller.data)
}

export function OffersPage() {
  const controller = useOffersController()

  return (
    <PageBody>
      <PageHeader
        title="Offers"
        description="Automatic discounts applied at checkout. Unlike a coupon, the buyer types nothing."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
              New offer
            </Button>
          </PermissionGate>
        }
      />
      <Guard controller={controller}>
        {(data) => (
          <SectionCard title="Offer rules" description="Applied after the buyer's price tier resolves">
            <ul className="divide-y divide-border-subtle">
              {data.items.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{offer.name}</span>
                    <span className="mt-0.5 block text-2xs text-ink-subtle">
                      {offer.scope} · when {offer.condition} → {offer.effect}
                    </span>
                  </span>
                  <span className="text-2xs text-ink-faint">
                    {offer.startsOn} → {offer.endsOn}
                  </span>
                  <span className="tabular text-2xs text-ink-muted">
                    {offer.redemptions.toLocaleString('en-IN')} used
                  </span>
                  <Switch id={offer.id} checked={offer.active} onChange={() => {}} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </Guard>
    </PageBody>
  )
}



export function BannersPage() {
  const banners = useBannersController()
  const cms = useCmsPagesController()

  return (
    <PageBody>
      <PageHeader
        title="Banners & content"
        description="Storefront placements and the policy pages buyers and sellers have to accept."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button variant="secondary" size="control" icon="add">
              New page
            </Button>
            <Button size="control" icon="add">
              New banner
            </Button>
          </PermissionGate>
        }
      />

      <InlineAlert tone="warning" title="Publishing a new policy version resets acceptance">
        Every seller and buyer who accepted the previous version is prompted again on their next
        sign-in. Their old acceptance stays on record with its timestamp and IP.
      </InlineAlert>

      <Guard controller={banners}>
        {(data) => (
          <SectionCard title="Banners" description="Lower priority number wins the slot">
            <Table
              className="rounded-none border-0 border-t"
              columns={BANNER_COLUMNS}
              data={data.items}
              getRowKey={(row) => row.id}
              density="compact"
            />
          </SectionCard>
        )}
      </Guard>

      <Guard controller={cms}>
        {(data) => (
          <SectionCard title="CMS pages" description="Legal text is supplied by the client; this is the publishing surface">
            <Table
              className="rounded-none border-0 border-t"
              columns={CMS_COLUMNS}
              data={data.items}
              getRowKey={(row) => row.id}
              density="compact"
            />
          </SectionCard>
        )}
      </Guard>
    </PageBody>
  )
}

// Templates are data, not code. DLT-approved SMS text cannot be edited freely
// once registered with TRAI — so the panel shows the registration state rather
// than pretending the text is freely editable.
export function TemplatesPage() {
  const controller = useTemplatesController()
  const blocked =
    controller.data?.items.filter(
      (row) => row.channels.includes('sms') && ['pending', 'rejected'].includes(row.dltStatus),
    ) || []

  return (
    <PageBody>
      <PageHeader
        title="Notification templates"
        description="One template per event, per channel. SMS text must be registered with TRAI before it can send."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
              New template
            </Button>
          </PermissionGate>
        }
      />

      {blocked.length > 0 && (
        <InlineAlert tone="danger" title={`${blocked.length} SMS templates cannot send`}>
          {blocked.map((row) => row.name).join(', ')} — DLT registration is pending or was
          rejected. Registration is client-owned and takes 3 to 10 working days.
        </InlineAlert>
      )}

      <Guard controller={controller}>
        {(data) => (
          <SectionCard title="Templates" description="Editing approved SMS text requires re-registration">
            <ul className="divide-y divide-border-subtle">
              {data.items.map((template) => (
                <li key={template.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      {template.name}
                    </span>
                    <span className="tabular block text-2xs text-ink-faint">
                      {template.trigger}
                    </span>
                  </span>

                  <span className="flex gap-1">
                    {template.channels.map((channel) => (
                      <Badge key={channel} tone="neutral" size="sm">
                        {channel.toUpperCase()}
                      </Badge>
                    ))}
                  </span>

                  <span className="flex w-52 items-center gap-2">
                    <Badge tone={DLT_TONE[template.dltStatus]} size="sm" dot>
                      {DLT_LABEL[template.dltStatus]}
                    </Badge>
                    {template.dltTemplateId && (
                      <span className="tabular truncate text-2xs text-ink-faint">
                        {template.dltTemplateId}
                      </span>
                    )}
                  </span>

                  <Switch id={template.id} checked={template.active} onChange={() => {}} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </Guard>
    </PageBody>
  )
}
