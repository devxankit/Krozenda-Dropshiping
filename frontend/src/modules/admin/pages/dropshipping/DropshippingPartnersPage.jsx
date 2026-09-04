import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useDropshipPartnersController } from '../../controllers/useDropshippingController'
import {
  DROPSHIP_PARTNER_COLUMNS,
  DROPSHIP_PARTNER_FILTERS,
  DROPSHIP_PARTNER_TABS,
} from '../../tableColumns/dropshippingColumns'
import { OnboardPartnerModal } from '../../components/dropshipping/OnboardPartnerModal'
import { PartnerDetailDrawer } from '../../components/dropshipping/PartnerDetailDrawer'

export function DropshippingPartnersPage() {
  const list = useDropshipPartnersController()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState(null)

  const unlinked = list.items.filter((row) => !row.routeLinked).length

  return (
    <>
      <ListScreen
        title="Dropshipping Partners & Suppliers"
        description="External companies, manufacturers, wholesalers and distributors operating under Model A Direct Dropshipping."
        actions={
          <>
            <ExportMenu onExport={() => {}} />
            <PermissionGate permission={ADMIN_PERMISSIONS.PEOPLE_MANAGE}>
              <Button size="control" icon="add" onClick={() => setOnboardOpen(true)}>
                Onboard supplier
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          unlinked > 0 && (
            <InlineAlert tone="warning" title={`${unlinked} suppliers awaiting Razorpay Route account setup`}>
              Suppliers must have a linked Razorpay Route account and approved KYC before receiving automated settlements for fulfilled dropship orders.
            </InlineAlert>
          )
        }
        controller={list}
        columns={DROPSHIP_PARTNER_COLUMNS}
        filters={DROPSHIP_PARTNER_FILTERS}
        tabs={DROPSHIP_PARTNER_TABS}
        searchPlaceholder="Supplier name, city, GSTIN or type…"
        itemLabel="dropship partners"
        emptyIcon="sellers"
        emptyTitle="No dropshipping partners match these filters"
        onRowClick={(row) => setSelectedPartner(row)}
      />

      <OnboardPartnerModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onAddPartner={list.addPartner}
      />

      <PartnerDetailDrawer
        partner={selectedPartner}
        isOpen={Boolean(selectedPartner)}
        onClose={() => setSelectedPartner(null)}
        onToggleStatus={list.togglePartnerStatus}
      />
    </>
  )
}
