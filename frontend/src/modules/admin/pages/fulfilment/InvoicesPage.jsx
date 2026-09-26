import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useInvoiceListController } from '../../controllers/useFulfilmentController'
import { INVOICE_COLUMNS, INVOICE_TABS } from '../../tableColumns/fulfilmentColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

export function InvoicesPage() {
  const navigate = useNavigate()
  const list = useInvoiceListController()

  return (
    <ListScreen
      title="Invoices"
      description="GST tax invoices for every order — one per seller of record."
      actions={<ExportMenu onExport={() => downloadTableCsv('invoices.csv', INVOICE_COLUMNS, list.items)} />}
      banner={
        <InlineAlert tone="info" title="Seller of record differs by business model">
          Under dropshipping and own stock the Krozenda entity invoices the buyer. Under
          marketplace the vendor does, and Krozenda invoices the vendor for commission separately.
        </InlineAlert>
      }
      controller={list}
      columns={INVOICE_COLUMNS}
      tabs={INVOICE_TABS}
      searchPlaceholder="Invoice number, sub-order or buyer…"
      onRowClick={(row) => navigate(adminPath.invoiceDetail(row.id))}
      itemLabel="invoices"
      emptyIcon="invoices"
      emptyTitle="No invoices in this view"
    />
  )
}
