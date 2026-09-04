import { useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { TaxInvoice } from '../../components/fulfilment/TaxInvoice'
import { KeyValueList, SectionCard, formatMoney } from '../../components/display'
import { useInvoiceDetailController } from '../../controllers/useFulfilmentController'

export function InvoiceDetailPage() {
  const { invoiceId } = useParams()
  const { invoice, isLoading, error, refetch } = useInvoiceDetailController(invoiceId)

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
        title={invoice.number}
        trail={[{ label: invoice.number }]}
        actions={
          <>
            <Button variant="secondary" size="control" icon="print">
              Packing slip
            </Button>
            <Button variant="secondary" size="control" icon="print">
              Print
            </Button>
            <Button size="control" icon="download">
              Download PDF
            </Button>
          </>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={invoice.isInterState ? 'accent' : 'brand'} size="sm">
            {invoice.isInterState ? 'IGST' : 'CGST + SGST'}
          </Badge>
          <span className="tabular">{invoice.subOrderId}</span>
          <span className="text-border-strong">·</span>
          <span>Issued {invoice.issuedAt}</span>
        </div>
      </PageHeader>

      <InlineAlert tone="info" title={`Seller of record: ${invoice.sellerOfRecord}`}>
        Place of supply is {invoice.placeOfSupply}, and the supplier is registered in Maharashtra —
        so this is an inter-state supply and attracts IGST rather than CGST and SGST.
      </InlineAlert>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <TaxInvoice invoice={invoice} />

        <div className="flex flex-col gap-4">
          <SectionCard title="Summary">
            <div className="px-4 py-2">
              <KeyValueList
                items={[
                  { label: 'Taxable value', value: formatMoney(invoice.taxableValue) },
                  { label: 'GST', value: formatMoney(invoice.gst) },
                  { label: 'Invoice total', value: formatMoney(invoice.total) },
                  { label: 'Place of supply', value: invoice.placeOfSupply },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Parties">
            <div className="px-4 py-2">
              <KeyValueList
                items={[
                  { label: 'Supplier', value: invoice.seller.name },
                  { label: 'Supplier GSTIN', value: <span className="tabular">{invoice.seller.gstin}</span> },
                  { label: 'Recipient', value: invoice.buyerDetail.name },
                  {
                    label: 'Recipient GSTIN',
                    value: invoice.buyerDetail.gstin ? (
                      <span className="tabular">{invoice.buyerDetail.gstin}</span>
                    ) : (
                      <span className="text-ink-faint">Unregistered (B2C)</span>
                    ),
                  },
                ]}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </PageBody>
  )
}
