import { Button, Input, Table } from '../../../../components/ui'
import { FormSection } from '../../components/forms'
import { InlineAlert } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { SettingsShell } from '../../components/system/SettingsShell'
import { IntegrationCard } from '../../components/system/IntegrationCard'
import { SLAB_COLUMNS } from '../../tableColumns/systemColumns'
import { useIntegrationsController, useTaxSettingsController } from '../../controllers/useSystemController'

export { GeneralSettingsPage } from './GeneralSettingsPage'


export function TaxSettingsPage() {
  const controller = useTaxSettingsController()

  return (
    <SettingsShell
      title="Taxes & HSN"
      description="The GST slabs a product can be assigned, and the rules that decide how tax is applied."
      controller={controller}
    >
      {(data) => (
        <>
          <SectionCard title="GST slabs" description="A product must be on exactly one slab">
            <Table
              className="rounded-none border-0 border-t"
              columns={SLAB_COLUMNS}
              data={data.slabs}
              getRowKey={(row) => row.rate}
              density="compact"
            />
          </SectionCard>

          <FormSection title="Defaults">
            <Input id="pos" label="Place of supply" size="control" defaultValue={data.defaults.placeOfSupplyRule} disabled />
            <Input id="hsn" label="HSN required" size="control" defaultValue={data.defaults.hsnRequiredFrom} disabled />
            <Input id="rounding" label="Rounding" size="control" defaultValue={data.defaults.roundingRule} />
            <Input id="prefix" label="Invoice prefix" size="control" defaultValue={data.defaults.invoicePrefix} />
          </FormSection>

          <InlineAlert tone="info" title="Place of supply decides IGST against CGST plus SGST">
            When the buyer&rsquo;s state differs from the supplier&rsquo;s registered state the supply is
            inter-state and attracts IGST. Same state splits into CGST and SGST at half the rate
            each.
          </InlineAlert>
        </>
      )}
    </SettingsShell>
  )
}


// Logistics moved to its own file when it stopped being a fixture-backed
// placeholder and became a real form: see ./LogisticsSettingsPage.jsx.

export function IntegrationHealthPage() {
  const controller = useIntegrationsController()

  return (
    <SettingsShell
      title="Integration health"
      description="Live status for the five integrations in scope. Nothing else is connected."
      controller={controller}
      actions={
        <Button
          variant="secondary"
          size="control"
          icon="refresh"
          onClick={() => controller.refetch()}
          isLoading={controller.isFetching}
        >
          Re-check now
        </Button>
      }
    >
      {(data) => data.items.map((item) => <IntegrationCard key={item.id} integration={item} />)}
    </SettingsShell>
  )
}
