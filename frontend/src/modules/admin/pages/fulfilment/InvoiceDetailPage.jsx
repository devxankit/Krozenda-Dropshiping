import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { TaxInvoice } from '../../components/fulfilment/TaxInvoice'
import { PackingSlip } from '../../components/fulfilment/PackingSlip'
import { KeyValueList, SectionCard, formatMoney } from '../../components/display'
import { useInvoiceDetailController } from '../../controllers/useFulfilmentController'
import { toast } from '../../../../lib/toast'

export function InvoiceDetailPage() {
  const { invoiceId } = useParams()
  const { invoice, isLoading, error, refetch } = useInvoiceDetailController(invoiceId)
  const [viewMode, setViewMode] = useState('invoice') // 'invoice' | 'packing_slip'

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

  const handlePrint = (mode = viewMode) => {
    toast.dismiss()
    if (mode !== viewMode) {
      setViewMode(mode)
      setTimeout(() => window.print(), 100)
    } else {
      window.print()
    }
  }

  const handleDownloadPdf = () => {
    toast.dismiss()
    if (viewMode !== 'invoice') {
      setViewMode('invoice')
      setTimeout(() => window.print(), 100)
    } else {
      window.print()
    }
  }

  return (
    <PageBody>
      {/* Top Header & Actions (hidden on print) */}
      <div className="print:hidden flex flex-col gap-4">
        <PageHeader
          title={viewMode === 'packing_slip' ? `Packing Slip (${invoice.subOrderId})` : invoice.number}
          trail={[{ label: invoice.number }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-surface p-1 mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode('invoice')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'invoice'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-ink-subtle hover:text-slate-900'
                  }`}
                >
                  Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('packing_slip')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === 'packing_slip'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-ink-subtle hover:text-slate-900'
                  }`}
                >
                  Packing Slip
                </button>
              </div>

              <Button
                variant="secondary"
                size="control"
                icon="print"
                onClick={() => handlePrint(viewMode)}
              >
                Print {viewMode === 'packing_slip' ? 'Slip' : 'Invoice'}
              </Button>
              <Button
                variant="primary"
                size="control"
                icon="download"
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            </div>
          }
        >
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
            <Badge tone={invoice.isInterState ? 'accent' : 'brand'} size="sm">
              {invoice.isInterState ? 'IGST 18%' : 'CGST + SGST'}
            </Badge>
            <span className="tabular font-medium text-slate-800">{invoice.subOrderId}</span>
            <span className="text-border-strong">·</span>
            <span>Issued {invoice.issuedAt}</span>
            <span className="text-border-strong">·</span>
            <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-2xs">
              Verified & Paid
            </span>
          </div>
        </PageHeader>

        <InlineAlert tone="info" title={`Seller of record: ${invoice.sellerOfRecord}`}>
          Place of supply is {invoice.placeOfSupply}, and the supplier is registered in Maharashtra —
          so this is an inter-state supply and attracts IGST rather than CGST and SGST.
        </InlineAlert>
      </div>

      {/* Main Document & Side Rails */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div id="printable-invoice" className="w-full">
          {viewMode === 'packing_slip' && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-blue-50/80 px-4 py-2.5 border border-blue-200 text-xs text-blue-900 print:hidden shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="font-semibold">Warehouse Packing Slip View</span>
                <span className="text-blue-700 text-2xs">(Designed for dispatch check without tax lines)</span>
              </div>
              <button
                onClick={() => setViewMode('invoice')}
                className="font-bold underline hover:text-blue-700 text-xs"
              >
                Switch to Tax Invoice
              </button>
            </div>
          )}

          {viewMode === 'invoice' ? (
            <TaxInvoice invoice={invoice} />
          ) : (
            <PackingSlip invoice={invoice} />
          )}
        </div>

        {/* Right Summary Side Cards (Hidden on Print) */}
        <div className="flex flex-col gap-4 print:hidden">
          <SectionCard title="Invoice Summary">
            <div className="px-4 py-2">
              <KeyValueList
                items={[
                  { label: 'Taxable value', value: formatMoney(invoice.taxableValue) },
                  { label: 'GST Amount', value: formatMoney(invoice.gst) },
                  { label: 'Invoice Total', value: formatMoney(invoice.total) },
                  { label: 'Place of supply', value: invoice.placeOfSupply },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Parties & Compliance">
            <div className="px-4 py-2">
              <KeyValueList
                items={[
                  { label: 'Supplier', value: invoice.seller.name },
                  { label: 'Supplier GSTIN', value: <span className="tabular font-mono text-2xs">{invoice.seller.gstin}</span> },
                  { label: 'Recipient', value: invoice.buyerDetail.name },
                  {
                    label: 'Recipient GSTIN',
                    value: invoice.buyerDetail.gstin ? (
                      <span className="tabular font-mono text-2xs">{invoice.buyerDetail.gstin}</span>
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
