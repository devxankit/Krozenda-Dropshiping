import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useVendorListController } from '../../controllers/usePeopleController'
import { VENDOR_COLUMNS, VENDOR_FILTERS, VENDOR_TABS } from '../../tableColumns/peopleColumns'
import { OnboardPartnerModal } from '../../components/dropshipping/OnboardPartnerModal'
import { PartnerDetailDrawer } from '../../components/dropshipping/PartnerDetailDrawer'

export function VendorsPage() {
  const list = useVendorListController()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)

  const unlinked = list.items.filter((row) => !row.routeLinked && row.model !== 'own_stock').length

  return (
    <>
      <ListScreen
        title="Sellers & partners"
        description="Marketplace sellers, dropshipping partners and the platform's own stock, in one directory."
        actions={
          <>
            <ExportMenu onExport={() => {}} />
            <PermissionGate permission={ADMIN_PERMISSIONS.PEOPLE_MANAGE}>
              <Button size="control" icon="add" onClick={() => setOnboardOpen(true)}>
                Add partner
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          unlinked > 0 && (
            <InlineAlert
              tone="warning"
              title={`${unlinked} vendors cannot be paid yet`}
            >
              A vendor without a Razorpay Route linked account is excluded from every settlement
              batch. The account is created when their KYC is approved.
            </InlineAlert>
          )
        }
        controller={list}
        columns={VENDOR_COLUMNS}
        filters={VENDOR_FILTERS}
        tabs={VENDOR_TABS}
        searchPlaceholder="Name, city, GSTIN or role…"
        itemLabel="vendors"
        emptyIcon="sellers"
        emptyTitle="No vendors match these filters"
        onRowClick={(row) => setSelectedVendor(row)}
      />

      <OnboardPartnerModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onAddPartner={() => list.refetch?.()}
      />

      <PartnerDetailDrawer
        partner={selectedVendor}
        isOpen={Boolean(selectedVendor)}
        onClose={() => setSelectedVendor(null)}
      />
    </>
  )
}
